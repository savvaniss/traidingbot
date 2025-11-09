# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from binance import AsyncClient, BinanceSocketManager
import asyncio

SYMBOL = "BTCUSDT"
USE_TESTNET = True  # flip to False for mainnet later

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

latest = {"symbol": SYMBOL, "price": 0.0, "ts": 0}

@app.on_event("startup")
async def on_startup():
    # Create one client/socket manager for the app lifetime
    app.state.client = await AsyncClient.create(testnet=USE_TESTNET)
    app.state.bm = BinanceSocketManager(app.state.client)
    app.state.stop_event = asyncio.Event()
    app.state.stream_task = asyncio.create_task(stream_price())

@app.on_event("shutdown")
async def on_shutdown():
    # Signal the stream to stop
    app.state.stop_event.set()
    task = app.state.stream_task
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    # Close Binance client cleanly
    client = app.state.client
    if client:
        await client.close_connection()

async def stream_price():
    """Background task: keep updating `latest` from trade socket."""
    socket = app.state.bm.trade_socket(SYMBOL.lower())
    try:
        async with socket as stream:
            while not app.state.stop_event.is_set():
                msg = await stream.recv()
                # msg: 'p' price, 'T' trade time (ms)
                latest["price"] = float(msg["p"])
                latest["ts"] = int(msg["T"])
    except asyncio.CancelledError:
        # Task cancelled during reload/shutdown
        raise
    except Exception as e:
        # Optional: log & try to restart socket after a short backoff
        print("stream_price error:", e)
        await asyncio.sleep(1)

@app.get("/tick")
async def get_tick():
    return latest

@app.get("/signal")
async def get_signal():
    # Placeholder: wire real EMA/ATR later
    return {
        "symbol": latest["symbol"],
        "side": "BUY" if (latest["ts"] // 1000) % 2 == 0 else "SELL",
        "confidence": 0.5,
        "reasons": [{"label": "Live", "value": "Binance trade stream"}],
        "stopPrice": None, "takeProfit": None,
        "targetExposureUsd": 1000,
    }

@app.post("/orders")
async def post_orders(order: dict):
    print("Paper order:", order)
    return {"status": "ok", "order": order}
