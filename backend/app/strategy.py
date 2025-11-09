import time
from typing import Dict, Tuple, List, Optional
from .config import EMA_FAST, EMA_SLOW, ATR_LEN
from .state import candles, signal_state, latest_prices
from .indicators import ema, atr
from .exchange import base_quote, quantize

def decide_side(sym: str, cfg: Dict) -> Tuple[str, float, Dict]:
    buf = candles[sym]
    if len(buf) < max(EMA_SLOW + 1, ATR_LEN + 1):
        return "FLAT", 0.2, {"explanation":"Warming up: not enough closed bars", "bars": len(buf)}

    closes = [c[3] for c in buf]
    highs  = [c[1] for c in buf]
    lows   = [c[2] for c in buf]

    ema_fast = ema(closes, EMA_FAST)
    ema_slow = ema(closes, EMA_SLOW)
    curr_atr = atr(highs, lows, closes, ATR_LEN)
    price    = closes[-1]

    if ema_fast is None or ema_slow is None or curr_atr is None or price <= 0:
        return "FLAT", 0.2, {"explanation":"Insufficient data for indicators"}

    atr_pct = (curr_atr / price) * 100.0
    raw_side = "BUY" if ema_fast > ema_slow else ("SELL" if ema_fast < ema_slow else "FLAT")

    if atr_pct < cfg["minAtrPct"] and curr_atr < cfg["minAtrUsd"]:
        return "FLAT", 0.3, {"explanation":"ATR below thresholds", "ema_fast":ema_fast,"ema_slow":ema_slow,
                             "atr_pct":atr_pct, "atr_usd":curr_atr, "price":price}

    st = signal_state[sym]
    now = int(time.time())

    if raw_side == "FLAT":
        st["streak"] = 0
        return "FLAT", 0.3, {"explanation":"EMAs equal → no edge", "ema_fast":ema_fast,"ema_slow":ema_slow,
                             "atr_pct":atr_pct,"atr_usd":curr_atr,"price":price}

    if raw_side == st["side"]:
        st["streak"] = 0
        return st["side"], 0.6, {"explanation":f"Holding {st['side']} (EMAs agree)","ema_fast":ema_fast,
                                 "ema_slow":ema_slow,"atr_pct":atr_pct,"atr_usd":curr_atr,"price":price}

    st["streak"] += 1
    if st["streak"] < cfg["confirmStreak"]:
        return "FLAT", 0.4, {"explanation":f"Transition to {raw_side} needs {cfg['confirmStreak']-st['streak']} more bar(s)",
                             "streak":st["streak"],"target_side":raw_side,"ema_fast":ema_fast,"ema_slow":ema_slow,
                             "atr_pct":atr_pct,"atr_usd":curr_atr,"price":price}

    if now - st["last_flip"] < cfg["flipCooldownSec"]:
        remain = cfg["flipCooldownSec"] - (now - st["last_flip"])
        st["streak"] = 0
        return "FLAT", 0.4, {"explanation":f"Cooldown active: {remain}s","cooldown":remain,"ema_fast":ema_fast,
                             "ema_slow":ema_slow,"atr_pct":atr_pct,"atr_usd":curr_atr,"price":price}

    st["side"] = raw_side
    st["last_flip"] = now
    st["streak"] = 0
    return raw_side, 0.7, {"explanation":f"{raw_side} confirmed (EMA{EMA_FAST} vs EMA{EMA_SLOW})",
                           "ema_fast":ema_fast,"ema_slow":ema_slow,"atr_pct":atr_pct,"atr_usd":curr_atr,"price":price}

def compute_signal(s: str, riskLevel: float, maxExposureUsd: float, cfg: Dict, balances: Dict) -> Dict:
    s = s.upper()
    side, conf, diag = decide_side(s, cfg)
    explanation = diag.get("explanation","")
    price = float(diag.get("price") or latest_prices.get(s, 0.0))
    curr_atr = float(diag.get("atr_usd") or 0.0)

    base, quote = base_quote(s)
    base_qty  = float(balances.get(base, 0.0))
    quote_qty = float(balances.get(quote, 0.0))

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

    stop_price = None
    take_profit = None
    if price > 0 and curr_atr > 0 and side in ("BUY","SELL"):
        risk = cfg["stopAtrMult"] * curr_atr
        if side == "BUY":
            stop_price = max(0.01, price - risk)
            take_profit = price + cfg["tpRiskMultiple"] * (price - stop_price)
        else:
            stop_price = price + risk
            take_profit = price - cfg["tpRiskMultiple"] * (stop_price - price)

    reasons = [
        {"label":"Price","value":round(price,6)},
        {"label":"Base held","value":round(base_qty,6)},
        {"label":"Quote held","value":round(quote_qty,2)},
        {"label":"Risk level","value":riskLevel},
        {"label":"Max exposure","value":maxExposureUsd},
        {"label":"EMA_FAST","value":round(float(diag.get("ema_fast",0.0)),6)},
        {"label":"EMA_SLOW","value":round(float(diag.get("ema_slow",0.0)),6)},
        {"label":"ATR_PCT","value":round(float(diag.get("atr_pct",0.0)),6)},
    ]

    return {
        "symbol": s,
        "side": side,
        "confidence": conf,
        "reasons": reasons,
        "explanation": explanation,
        "stopPrice": stop_price,
        "takeProfit": take_profit,
        "targetExposureUsd": (min(maxExposureUsd, quote_qty) * riskLevel) if side=="BUY" else 0.0,
        "suggestedQtyBase": suggested,
    }
