import math
from typing import Tuple, Optional
from binance import AsyncClient
from .config import USE_TESTNET

def base_quote(symbol: str) -> Tuple[str,str]:
    s = symbol.upper()
    for q in ("USDT","USDC","FDUSD","TUSD"):
        if s.endswith(q):
            return s[:-len(q)], q
    return s[:-3], s[-3:]

def quantize(qty: float, step: float = 1e-6) -> float:
    return math.floor(qty / step) * step if step > 0 else qty

def snap_qty(symbol: str, qty: float) -> float:
    # TODO: fetch exchangeInfo filters and cache; use stepSize per symbol
    return quantize(max(qty, 0.0), 1e-6)

async def make_client(api_key: Optional[str], api_secret: Optional[str]) -> AsyncClient:
    return await AsyncClient.create(api_key=api_key, api_secret=api_secret, testnet=USE_TESTNET)

async def place_order(cli: AsyncClient, symbol: str, side: str, qty: float, prefer_maker: bool, limit_px: float | None):
    from binance.enums import ORDER_TYPE_LIMIT_MAKER, ORDER_TYPE_MARKET, TIME_IN_FORCE_GTC, SIDE_BUY, SIDE_SELL
    side_c = SIDE_BUY if side == "BUY" else SIDE_SELL
    qty = snap_qty(symbol, qty)
    if qty <= 0:
        return None
    if prefer_maker and limit_px:
        return await cli.create_order(
            symbol=symbol, side=side_c, type=ORDER_TYPE_LIMIT_MAKER,
            quantity=qty, price=f"{limit_px:.2f}", timeInForce=TIME_IN_FORCE_GTC,
            newOrderRespType="RESULT"
        )
    else:
        return await cli.create_order(
            symbol=symbol, side=side_c, type=ORDER_TYPE_MARKET,
            quantity=qty, newOrderRespType="RESULT"
        )
