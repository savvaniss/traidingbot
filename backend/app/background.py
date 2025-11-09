import asyncio, time
from typing import List
from binance import AsyncClient, BinanceSocketManager
from .config import SYMBOLS, USE_TESTNET, BIN_KEY, BIN_SEC
from .state import latest_prices, latest_ts, candles, balances_cache, config, autotrade_enabled, autotrade_symbols, log_order
from .exchange import make_client, place_order, snap_qty
from .strategy import compute_signal

async def refresh_candles_loop(stop_event, client_factory):
    while not stop_event.is_set():
        tf = config["timeframe"]
        cli = None
        try:
            cli = await client_factory()
            for sym in SYMBOLS:
                ks = await cli.get_klines(symbol=sym, interval=tf, limit=200)
                buf = candles[sym]
                buf.clear()
                for k in ks:
                    o,h,l,c = float(k[1]), float(k[2]), float(k[3]), float(k[4])
                    buf.append((o,h,l,c))
                latest_prices[sym] = float(ks[-1][4])
                latest_ts[sym] = int(ks[-1][6])
        except Exception as e:
            print("kline loop error:", e)
        finally:
            if cli:
                try: await cli.close_connection()
                except Exception: pass
        await asyncio.sleep(5)

async def stream_prices_loop(stop_event, client: AsyncClient):
    bm = BinanceSocketManager(client)
    async def run_socket(sym: str):
        sock = bm.trade_socket(sym.lower())
        async with sock as s:
            while not stop_event.is_set():
                msg = await s.recv()
                latest_prices[sym] = float(msg["p"])
                latest_ts[sym] = int(msg["T"])
    await asyncio.gather(*(run_socket(sym) for sym in SYMBOLS))

async def refresh_balances_loop(stop_event, client_factory):
    if not BIN_KEY or not BIN_SEC:
        # no keys provided -> just idle to allow later enabling
        while not stop_event.is_set():
            await asyncio.sleep(10)
        return
    while not stop_event.is_set():
        cli = None
        try:
            cli = await client_factory()
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

async def execution_loop(stop_event, client_factory):
    # defaults (could be made configurable via /autotrade opts)
    riskLevel = 0.35
    maxExposureUsd = 2000.0
    prefer_maker = True
    slippage_bps = 10

    while not stop_event.is_set():
        try:
            if not autotrade_enabled or not autotrade_symbols:
                await asyncio.sleep(1); continue

            cli = await client_factory()
            try:
                for sym in list(autotrade_symbols):
                    sig = compute_signal(sym, riskLevel, maxExposureUsd, config, balances_cache)
                    side = sig["side"]
                    px = latest_prices.get(sym, 0.0)
                    if side not in ("BUY","SELL") or px <= 0:
                        continue

                    qty = float(sig.get("suggestedQtyBase") or 0.0)
                    if qty <= 0:
                        usd = min(float(sig.get("targetExposureUsd") or 0.0), 200.0)
                        qty = usd / px

                    qty = snap_qty(sym, qty)
                    if qty <= 0:
                        continue

                    limit_px = px * (1 - slippage_bps/1e4) if side=="BUY" else px * (1 + slippage_bps/1e4)

                    mode = "paper"
                    if BIN_KEY and BIN_SEC:
                        resp = await place_order(cli, sym, side, qty, prefer_maker, limit_px)
                        mode = "live"
                        log_order({"symbol": sym, "side": side, "qty": qty, "px": limit_px, "mode": mode, "resp": resp})
                        print(f"[AUTO {mode.upper()}] {sym} {side} {qty:.6f} @ ~{limit_px:.6f}")
                    else:
                        log_order({"symbol": sym, "side": side, "qty": qty, "px": limit_px, "mode": mode, "resp": None})
                        print(f"[AUTO PAPER] {sym} {side} {qty:.6f} @ ~{limit_px:.6f}")

                await asyncio.sleep(1)
            finally:
                await cli.close_connection()
        except Exception as e:
            print("execution_loop error:", e)
            await asyncio.sleep(2)
