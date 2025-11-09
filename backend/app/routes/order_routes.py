from fastapi import APIRouter, HTTPException
from typing import Optional
from ..models import OrderIn
from ..config import BIN_KEY, BIN_SEC, USE_TESTNET
from ..exchange import make_client, place_order
from ..state import log_order, order_log

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
    # Paper -> just log
    if order.paperTrading:
        entry = {
            "symbol": order.symbol.upper(),
            "side": order.side.upper(),
            "qty": order.qty,
            "px": order.limitPrice,
            "mode": "paper",
            "resp": None,
        }
        log_order(entry)
        return {"status": "paper_ok", "echo": order.dict()}

    if not BIN_KEY or not BIN_SEC:
        raise HTTPException(status_code=400, detail="Missing BINANCE_KEY_TESTNET / BINANCE_SEC_TESTNET env vars.")

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
        log_order({
            "symbol": order.symbol.upper(),
            "side": order.side.upper(),
            "qty": order.qty,
            "px": order.limitPrice,
            "mode": "live",
            "resp": resp,
        })
        return {"status": "ok", "binance": resp}
    finally:
        await cli.close_connection()
