# backend/main.py
import os, math, asyncio, time
from typing import Dict, Tuple, List, Optional
from collections import deque

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from binance import AsyncClient, BinanceSocketManager

# =========================================================
# Config & constants
# =========================================================

# Keep ~5 hours of 1m bars (or fewer if timeframe > 1m)
CANDLE_MAX = 300

# Symbols to trade/stream
SYMBOLS: List[str] = [
    "BTCUSDC", "ETHUSDC", "BNBUSDC", "DOGEUSDC",
    "HBARUSDC", "XLMUSDC", "SOLUSDC", "XRPUSDC"
]

# Per-symbol buffers: (open, high, low, close)
candles = {s: deque(maxlen=CANDLE_MAX) for s in SYMBOLS}

# Flip control state
signal_state = {
    s: {"side": "FLAT", "last_flip": 0, "streak": 0} for s in SYMBOLS
}

# Indicator params
EMA_FAST = 20
EMA_SLOW = 50
ATR_LEN  = 14

# --- Live strategy config (editable via /config) ---
DEFAULT_CONFIG = {
    "timeframe": "1m",        # "1m" | "3m" | "5m"
    "minAtrPct": 0.02,        # % ATR floor to avoid chop
    "minAtrUsd": 8.0,         # absolute ATR floor in USD
    "confirmStreak": 2,       # bars required to confirm a flip
    "flipCooldownSec": 120,   # lockout after a flip (sec)
    # --- NEW risk knobs ---
    "stopAtrMult": 1.5,       # SL distance = ATR * this
    "tpRiskMultiple": 2.0,    # TP distance = (entry - stop) * this
}

# Env
load_dotenv()
USE_TESTNET = True
BIN_KEY = os.getenv("BINANCE_KEY_TESTNET")
BIN_SEC = os.getenv("BINANCE_SEC_TESTNET")

# Caches
latest_prices: Dict[str, float] = {s: 0.0 for s in SYMBOLS}
latest_ts: Dict[str, int]       = {s: 0 for s in SYMBOLS}
balances_cache: Dict[str, float] = {}  # asset -> qty (free+locked)

# =========================================================
# Helpers
# =========================================================

def base_quote(symbol: str) -> Tuple[str, str]:
    s = symbol.upper()
    for q in ("USDT", "USDC", "FDUSD", "TUSD"):
        if s.endswith(q):
            return s[:-len(q)], q
    # naive fallback
    return s[:-3], s[-3:]

def quantize(qty: float, step: float = 1e-6) -> float:
    return math.floor(qty / step) * step if step > 0 else qty

def ema(series: List[float], length: int) -> Optional[float]:
    if len(series) < length:
        return None
    k = 2 / (length + 1)
    e = series[-length]
    for v in series[-length+1:]:
        e = v * k + e * (1 - k)
    return e

def atr(highs: List[float], lows: List[float], closes: List[float], length: int) -> Optional[float]:
    if len(closes) < length + 1:
        return None
    trs = []
    for i in range(-length, 0):
        h, l, cprev = highs[i], lows[i], closes[i-1]
        trs.append(max(h - l, abs(h - cprev), abs(l - cprev)))
    return sum(trs) / len(trs)

def decide_side(sym: str):
    """
    Returns (side, confidence, diag)
    diag includes: explanation, ema_fast, ema_slow, atr_pct, atr_usd, price
    """
    cfg = app.state.config
    buf = candles[sym]
    if len(buf) < max(EMA_SLOW + 1, ATR_LEN + 1):
        return "FLAT", 0.2, {"explanation": "Warming up: not enough closed bars", "bars": len(buf)}

    closes = [c[3] for c in buf]
    highs  = [c[1] for c in buf]
    lows   = [c[2] for c in buf]

    ema_fast = ema(closes, EMA_FAST)
    ema_slow = ema(closes, EMA_SLOW)
    curr_atr = atr(highs, lows, closes, ATR_LEN)
    price    = closes[-1]

    if ema_fast is None or ema_slow is None or curr_atr is None or price <= 0:
        return "FLAT", 0.2, {"explanation": "Insufficient data for indicators"}

    atr_pct = (curr_atr / price) * 100.0
    raw_side = "BUY" if ema_fast > ema_slow else ("SELL" if ema_fast < ema_slow else "FLAT")

    # Volatility guard → both floors must be low to block trading
    if atr_pct < cfg["minAtrPct"] and curr_atr < cfg["minAtrUsd"]:
        return "FLAT", 0.3, {
            "explanation": "ATR below thresholds",
            "ema_fast": ema_fast, "ema_slow": ema_slow,
            "atr_pct": atr_pct, "atr_usd": curr_atr, "price": price
        }

    st = signal_state[sym]
    now = int(time.time())

    if raw_side == "FLAT":
        st["streak"] = 0
        return "FLAT", 0.3, {
            "explanation": "EMAs equal → no edge",
            "ema_fast": ema_fast, "ema_slow": ema_slow, "atr_pct": atr_pct,
            "atr_usd": curr_atr, "price": price
        }

    if raw_side == st["side"]:
        st["streak"] = 0
        return st["side"], 0.6, {
            "explanation": f"Holding {st['side']} (EMAs agree)",
            "ema_fast": ema_fast, "ema_slow": ema_slow, "atr_pct": atr_pct,
            "atr_usd": curr_atr, "price": price
        }

    # opposite → build streak
    st["streak"] += 1
    if st["streak"] < cfg["confirmStreak"]:
        return "FLAT", 0.4, {
            "explanation": f"Transition to {raw_side} needs {cfg['confirmStreak'] - st['streak']} more bar(s)",
            "streak": st["streak"], "target_side": raw_side,
            "ema_fast": ema_fast, "ema_slow": ema_slow, "atr_pct": atr_pct,
            "atr_usd": curr_atr, "price": price
        }

    # cooldown
    if now - st["last_flip"] < cfg["flipCooldownSec"]:
        remain = cfg["flipCooldownSec"] - (now - st["last_flip"])
        st["streak"] = 0
        return "FLAT", 0.4, {
            "explanation": f"Cooldown active: {remain}s",
            "cooldown": remain,
            "ema_fast": ema_fast, "ema_slow": ema_slow, "atr_pct": atr_pct,
            "atr_usd": curr_atr, "price": price
        }

    # flip confirmed
    st["side"] = raw_side
    st["last_flip"] = now
    st["streak"] = 0
    return raw_side, 0.7, {
        "explanation": f"{raw_side} confirmed (EMA{EMA_FAST} vs EMA{EMA_SLOW})",
        "ema_fast": ema_fast, "ema_slow": ema_slow, "atr_pct": atr_pct,
        "atr_usd": curr_atr, "price": price
    }

# =========================================================
# App & lifecycle
# =========================================================

app = FastAPI()
app.state.config = DEFAULT_CONFIG.copy()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

class OrderIn(BaseModel):
    symbol: str
    side: str                  # "BUY" | "SELL"
    qty: float                 # base asset amount
    limitPrice: Optional[float] = None
    tif: str = "GTC"           # "GTC" | "IOC" | "FOK"
    preferMaker: bool = True
    paperTrading: bool = True  # if true -> echo only

@app.on_event("startup")
async def on_startup():
    app.state.client = await AsyncClient.create(
        api_key=BIN_KEY if BIN_KEY else None,
        api_secret=BIN_SEC if BIN_SEC else None,
        testnet=USE_TESTNET
    )
    app.state.bm = BinanceSocketManager(app.state.client)
    app.state.stop_event = asyncio.Event()
    app.state.stream_task = asyncio.create_task(stream_prices_loop())
    app.state.bal_task = asyncio.create_task(refresh_balances_loop())
    app.state.kline_task = asyncio.create_task(refresh_candles_loop())

@app.on_event("shutdown")
async def on_shutdown():
    app.state.stop_event.set()
    for t in (
        getattr(app.state, "stream_task", None),
        getattr(app.state, "bal_task", None),
        getattr(app.state, "kline_task", None),
    ):
        if t:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
    if getattr(app.state, "client", None):
        await app.state.client.close_connection()

# =========================================================
# Background loops
# =========================================================

async def refresh_candles_loop():
    """Refresh recent candles for each symbol every ~5s via REST klines."""
    while not app.state.stop_event.is_set():
        tf = app.state.config["timeframe"]
        cli = None
        try:
            cli = await AsyncClient.create(
                api_key=BIN_KEY if BIN_KEY else None,
                api_secret=BIN_SEC if BIN_SEC else None,
                testnet=USE_TESTNET
            )
            for sym in SYMBOLS:
                ks = await cli.get_klines(symbol=sym, interval=tf, limit=200)
                buf = candles[sym]
                buf.clear()
                for k in ks:
                    o = float(k[1]); h = float(k[2]); l = float(k[3]); c = float(k[4])
                    buf.append((o, h, l, c))
                latest_prices[sym] = float(ks[-1][4])
                latest_ts[sym] = int(ks[-1][6])
        except Exception as e:
            print("kline loop error:", e)
        finally:
            if cli:
                try: await cli.close_connection()
                except Exception: pass
        await asyncio.sleep(5)

async def stream_prices_loop():
    """Keep last trade price/ts fresh via trade sockets (per symbol)."""
    async def run_socket(sym: str):
        sock = app.state.bm.trade_socket(sym.lower())
        async with sock as s:
            while not app.state.stop_event.is_set():
                msg = await s.recv()
                latest_prices[sym] = float(msg["p"])
                latest_ts[sym] = int(msg["T"])
    await asyncio.gather(*(run_socket(sym) for sym in SYMBOLS))

async def refresh_balances_loop():
    """Refresh balances every 10s if keys are present."""
    if not BIN_KEY or not BIN_SEC:
        while not app.state.stop_event.is_set():
            await asyncio.sleep(10)
        return

    while not app.state.stop_event.is_set():
        cli = None
        try:
            cli = await AsyncClient.create(api_key=BIN_KEY, api_secret=BIN_SEC, testnet=USE_TESTNET)
            acc = await cli.get_account()
            tmp = {}
            for b in acc["balances"]:
                qty = float(b["free"]) + float(b["locked"])
                if qty > 0:
                    tmp[b["asset"]] = qty
            balances_cache.clear()
            balances_cache.update(tmp)
        except Exception as e:
            print("balances loop error:", e)
        finally:
            if cli:
                try: await cli.close_connection()
                except Exception: pass
        await asyncio.sleep(10)

# =========================================================
# Config endpoints
# =========================================================

class ConfigIn(BaseModel):
    timeframe: Optional[str] = None
    minAtrPct: Optional[float] = None
    minAtrUsd: Optional[float] = None
    confirmStreak: Optional[int] = None
    flipCooldownSec: Optional[int] = None
    # NEW
    stopAtrMult: Optional[float] = None
    tpRiskMultiple: Optional[float] = None

@app.get("/config")
async def get_config():
    return app.state.config

@app.post("/config")
async def set_config(cfg: ConfigIn):
    current = app.state.config
    changed_tf = False

    if cfg.timeframe and cfg.timeframe != current["timeframe"]:
        current["timeframe"] = cfg.timeframe
        changed_tf = True

    if cfg.minAtrPct is not None:       current["minAtrPct"] = max(0.0, float(cfg.minAtrPct))
    if cfg.minAtrUsd is not None:       current["minAtrUsd"] = max(0.0, float(cfg.minAtrUsd))
    if cfg.confirmStreak is not None:   current["confirmStreak"] = max(1, int(cfg.confirmStreak))
    if cfg.flipCooldownSec is not None: current["flipCooldownSec"] = max(0, int(cfg.flipCooldownSec))
    if cfg.stopAtrMult is not None:     current["stopAtrMult"] = max(0.1, float(cfg.stopAtrMult))
    if cfg.tpRiskMultiple is not None:  current["tpRiskMultiple"] = max(0.1, float(cfg.tpRiskMultiple))

    if changed_tf:
        for sym in SYMBOLS:
            candles[sym].clear()
    return current

# =========================================================
# Data endpoints
# =========================================================

@app.get("/tick")
async def tick(symbol: str = Query("BTCUSDC")):
    s = symbol.upper()
    return {"symbol": s, "price": latest_prices.get(s, 0.0), "ts": latest_ts.get(s, 0)}

@app.get("/balances")
async def balances():
    return [{"asset": a, "free": q, "locked": 0.0} for a, q in sorted(balances_cache.items())]

@app.get("/portfolio")
async def portfolio():
    stables = {"USDT", "USDC", "FDUSD", "TUSD", "DAI", "USDP", "BFUSD"}
    equity = 0.0
    lines = []
    for asset, qty in balances_cache.items():
        if asset in stables:
            px = 1.0
        else:
            sym = f"{asset}USDT"
            px = latest_prices.get(sym, 0.0)
        usd = qty * (px or 0.0)
        equity += usd
        lines.append({"asset": asset, "qty": qty, "price": px, "usdValue": usd})
    return {"equityUsd": equity, "positions": lines}

# =========================================================
# Signal (with SL/TP) & Orders
# =========================================================

@app.get("/signal")
async def signal(
    symbol: str = Query("BTCUSDC"),
    riskLevel: float = Query(0.35, ge=0.0, le=1.0),
    maxExposureUsd: float = Query(2000.0, ge=0.0),
):
    s = symbol.upper()

    # Strategy decision on CLOSED candles
    side, conf, diag = decide_side(s)
    explanation = diag.get("explanation", "")
    price = float(diag.get("price") or latest_prices.get(s, 0.0))
    curr_atr = float(diag.get("atr_usd") or 0.0)

    base, quote = base_quote(s)
    base_qty  = float(balances_cache.get(base, 0.0))
    quote_qty = float(balances_cache.get(quote, 0.0))

    # Position-aware sizing
    if side == "BUY":
        spendable_usd = min(quote_qty, maxExposureUsd) * riskLevel
        target_base = (spendable_usd / price) if price > 0 else 0.0
        delta = max(0.0, target_base - base_qty)
    elif side == "SELL":
        target_base = 0.0
        delta = min(base_qty, base_qty - target_base)
    else:
        delta = 0.0
    suggested = quantize(delta, 1e-6)

    # --- NEW: SL/TP from ATR ---
    stop_price = None
    take_profit = None
    cfg = app.state.config
    if price > 0 and curr_atr > 0 and side in ("BUY", "SELL"):
        risk = cfg["stopAtrMult"] * curr_atr
        if side == "BUY":
            stop_price = max(0.01, price - risk)
            take_profit = price + cfg["tpRiskMultiple"] * (price - stop_price)
        else:
            stop_price = price + risk
            take_profit = price - cfg["tpRiskMultiple"] * (stop_price - price)

    # Reasons for UI
    reasons = [
        {"label": "Price", "value": round(price, 2)},
        {"label": "Base held", "value": round(base_qty, 6)},
        {"label": "Quote held", "value": round(quote_qty, 2)},
        {"label": "Risk level", "value": riskLevel},
        {"label": "Max exposure", "value": maxExposureUsd},
        {"label": "EMA_FAST", "value": round(float(diag.get("ema_fast", 0.0)), 6)},
        {"label": "EMA_SLOW", "value": round(float(diag.get("ema_slow", 0.0)), 6)},
        {"label": "ATR_PCT", "value": round(float(diag.get("atr_pct", 0.0)), 6)},
    ]

    return {
        "symbol": s,
        "side": side,
        "confidence": conf,
        "reasons": reasons,
        "explanation": explanation,
        "stopPrice": stop_price,
        "takeProfit": take_profit,
        "targetExposureUsd": (min(maxExposureUsd, quote_qty) * riskLevel) if side == "BUY" else 0.0,
        "suggestedQtyBase": suggested,
    }

@app.post("/orders")
async def post_orders(order: OrderIn):
    # Paper mode: echo only
    if order.paperTrading:
        return {"status": "paper_ok", "echo": order.dict()}

    if not BIN_KEY or not BIN_SEC:
        raise HTTPException(status_code=400, detail="Missing BINANCE_KEY_TESTNET / BINANCE_SEC_TESTNET env vars.")

    from binance.enums import (
        SIDE_BUY, SIDE_SELL,
        ORDER_TYPE_MARKET, ORDER_TYPE_LIMIT, ORDER_TYPE_LIMIT_MAKER,
        TIME_IN_FORCE_GTC, TIME_IN_FORCE_IOC, TIME_IN_FORCE_FOK
    )

    side_map = {"BUY": SIDE_BUY, "SELL": SIDE_SELL}
    tif_map  = {"GTC": TIME_IN_FORCE_GTC, "IOC": TIME_IN_FORCE_IOC, "FOK": TIME_IN_FORCE_FOK}

    side = side_map.get(order.side.upper())
    tif  = tif_map.get(order.tif.upper())
    if not side or not tif:
        raise HTTPException(status_code=400, detail="Invalid side or TIF")

    cli = await AsyncClient.create(api_key=BIN_KEY, api_secret=BIN_SEC, testnet=USE_TESTNET)
    try:
        if order.preferMaker:
            if not order.limitPrice:
                raise HTTPException(status_code=400, detail="limitPrice required for maker orders")
            resp = await cli.create_order(
                symbol=order.symbol.upper(),
                side=side,
                type=ORDER_TYPE_LIMIT_MAKER,
                quantity=round(order.qty, 6),
                price=f"{order.limitPrice:.2f}",
                newOrderRespType="RESULT",
            )
        else:
            if order.limitPrice:
                resp = await cli.create_order(
                    symbol=order.symbol.upper(),
                    side=side,
                    type=ORDER_TYPE_LIMIT,
                    timeInForce=tif,
                    quantity=round(order.qty, 6),
                    price=f"{order.limitPrice:.2f}",
                    newOrderRespType="RESULT",
                )
            else:
                resp = await cli.create_order(
                    symbol=order.symbol.upper(),
                    side=side,
                    type=ORDER_TYPE_MARKET,
                    quantity=round(order.qty, 6),
                    newOrderRespType="RESULT",
                )
        return {"status": "ok", "binance": resp}
    finally:
        await cli.close_connection()
