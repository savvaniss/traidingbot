# backend/app/routes/order_routes.py
from fastapi import APIRouter, HTTPException
from typing import Optional
from binance.exceptions import BinanceAPIException

from ..config import BIN_KEY, BIN_SEC
from ..exchange import make_client, place_order
from ..state import log_order, order_log
from ..models import OrderIn  # your Pydantic input model
import time

router = APIRouter()


@router.get("/orders/recent")
async def recent_orders(limit: int = 50):
    limit = max(1, min(200, limit))
    return list(reversed(order_log[-limit:]))


@router.get("/orders/open")
async def open_orders(symbol: Optional[str] = None):
    if not BIN_KEY or not BIN_SEC:
        return []
    cli = await make_client(BIN_KEY, BIN_SEC)
    try:
        if symbol:
            return await cli.get_open_orders(symbol=symbol.upper())
        return await cli.get_open_orders()
    finally:
        await cli.close_connection()


@router.get("/orders/trades")
async def recent_trades(symbol: str):
    if not BIN_KEY or not BIN_SEC:
        return []
    cli = await make_client(BIN_KEY, BIN_SEC)
    try:
        return await cli.get_my_trades(symbol=symbol.upper(), limit=50)
    finally:
        await cli.close_connection()


@router.post("/orders")
async def post_orders(order: OrderIn):
    if order.paperTrading:
        entry = {
            "ts": int(time.time()*1000),
            "symbol": order.symbol.upper(),
            "side": order.side.upper(),
            "qty": order.qty,
            "px": order.limitPrice,
            "mode": "paper",
            "status": "PAPER",
            "orderId": None,
            "executedQty": 0.0,
            "cummulativeQuoteQty": 0.0,
            "error": None,
        }
        log_order(entry)
        return {"status": "paper_ok"}

    if not BIN_KEY or not BIN_SEC:
        raise HTTPException(status_code=400, detail="Missing BINANCE_* env vars")

    cli = await make_client(BIN_KEY, BIN_SEC)
    try:
        resp = await place_order(
            cli,
            order.symbol.upper(),
            order.side.upper(),
            order.qty,
            order.preferMaker,
            order.limitPrice
        )
        entry = {
            "ts": int(time.time()*1000),
            "symbol": resp.get("symbol"),
            "side": resp.get("side"),
            "qty": float(resp.get("origQty", 0)),
            "px": float(resp.get("price", 0)),
            "mode": "live",
            "status": resp.get("status"),              # NEW/ FILLED/ PARTIALLY_FILLED/ CANCELED
            "orderId": resp.get("orderId"),
            "executedQty": float(resp.get("executedQty", 0)),
            "cummulativeQuoteQty": float(resp.get("cummulativeQuoteQty", 0)),
            "error": None,
        }
        log_order(entry)
        return {"status": "ok", "order": entry}
    except BinanceAPIException as be:
        entry = {
            "ts": int(time.time()*1000),
            "symbol": order.symbol.upper(),
            "side": order.side.upper(),
            "qty": order.qty,
            "px": order.limitPrice,
            "mode": "live",
            "status": "ERROR",
            "orderId": None,
            "executedQty": 0.0,
            "cummulativeQuoteQty": 0.0,
            "error": f"{be.status_code} {be.message}",
        }
        log_order(entry)
        raise HTTPException(status_code=400, detail=entry["error"])
    finally:
        await cli.close_connection()

@router.get("/orders/status")
async def order_status(symbol: str, orderId: int):
    """
    Fetch the authoritative status of a specific order from Binance.
    """
    if not BIN_KEY or not BIN_SEC:
        raise HTTPException(status_code=400, detail="API keys not configured")

    cli = await make_client(BIN_KEY, BIN_SEC)
    try:
        r = await cli.get_order(symbol=symbol.upper(), orderId=int(orderId))
        # return just the useful bits
        return {
            "symbol": r.get("symbol"),
            "orderId": r.get("orderId"),
            "status": r.get("status"),
            "side": r.get("side"),
            "price": float(r.get("price", 0)),
            "origQty": float(r.get("origQty", 0)),
            "executedQty": float(r.get("executedQty", 0)),
            "cummulativeQuoteQty": float(r.get("cummulativeQuoteQty", 0)),
            "time": r.get("time"),
            "updateTime": r.get("updateTime"),
            "type": r.get("type"),
        }
    finally:
        await cli.close_connection()
