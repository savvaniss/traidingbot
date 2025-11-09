# backend/app/exchange.py
import math
from typing import Tuple, Optional, Dict
from decimal import Decimal, ROUND_DOWN
from binance import AsyncClient
from binance.enums import (
    ORDER_TYPE_LIMIT_MAKER,
    ORDER_TYPE_LIMIT,
    ORDER_TYPE_MARKET,
    SIDE_BUY, SIDE_SELL,
    TIME_IN_FORCE_GTC,
)
from .config import USE_TESTNET, SYMBOLS

# ---- Exchange filters cache (symbol -> filters) ----
_filters: Dict[str, Dict[str, float]] = {}


def _d(v: float) -> Decimal:
    return Decimal(str(v))


def _snap_decimal(value: float, step: float) -> float:
    if step <= 0:
        return max(0.0, value)
    q = (_d(value) / _d(step)).to_integral_value(rounding=ROUND_DOWN) * _d(step)
    return float(q)


async def load_exchange_filters(api_key: Optional[str], api_secret: Optional[str]) -> None:
    """
    Fetch exchangeInfo and cache stepSize/tickSize/minNotional/minQty/maxQty per watched symbol.
    Call this once on startup (and you can refresh periodically if you like).
    """
    cli = await AsyncClient.create(api_key=api_key, api_secret=api_secret, testnet=USE_TESTNET)
    try:
        info = await cli.get_exchange_info()
        by_symbol = {s["symbol"]: s for s in info["symbols"]}
        _filters.clear()

        for sym in SYMBOLS:
            s = by_symbol.get(sym)
            if not s:
                continue

            def getflt(name: str):
                for f in s["filters"]:
                    if f["filterType"] == name:
                        return f
                return {}

            lot = getflt("LOT_SIZE")
            pricef = getflt("PRICE_FILTER")
            minnot = getflt("MIN_NOTIONAL")

            _filters[sym] = {
                "stepSize": float(lot.get("stepSize", "0.000001")),
                "minQty": float(lot.get("minQty", "0")),
                "maxQty": float(lot.get("maxQty", "999999999")),
                "tickSize": float(pricef.get("tickSize", "0.01")),
                "minNotional": float(minnot.get("minNotional", "0")),
            }
    finally:
        await cli.close_connection()


def get_filters(symbol: str) -> Dict[str, float]:
    return _filters.get(symbol.upper(), {
        "stepSize": 1e-6,
        "minQty": 0.0,
        "maxQty": 1e12,
        "tickSize": 0.01,
        "minNotional": 0.0,
    })


def snap_qty(symbol: str, qty: float) -> float:
    f = get_filters(symbol)
    return _snap_decimal(qty, f["stepSize"])


def snap_price(symbol: str, px: float) -> float:
    f = get_filters(symbol)
    return _snap_decimal(px, f["tickSize"])


def base_quote(symbol: str) -> Tuple[str, str]:
    s = symbol.upper()
    for q in ("USDT", "USDC", "FDUSD", "TUSD"):
        if s.endswith(q):
            return s[:-len(q)], q
    return s[:-3], s[-3:]


def quantize(qty: float, step: float = 1e-6) -> float:
    return math.floor(qty / step) * step if step > 0 else qty


async def make_client(api_key: Optional[str], api_secret: Optional[str]) -> AsyncClient:
    return await AsyncClient.create(api_key=api_key, api_secret=api_secret, testnet=USE_TESTNET)


def _enforce_qty_px(symbol: str, qty: float, price: Optional[float]) -> Tuple[float, Optional[float], Optional[str]]:
    """
    Snap qty/price and validate minQty/maxQty/minNotional.
    Returns (qty, price, error_message_if_any)
    """
    f = get_filters(symbol)

    sqty = snap_qty(symbol, max(0.0, qty))
    spx = snap_price(symbol, price) if (price is not None) else None

    # min/max qty
    if sqty < f["minQty"]:
        return sqty, spx, f"qty {sqty} < minQty {f['minQty']} (LOT_SIZE)"
    if sqty > f["maxQty"]:
        return sqty, spx, f"qty {sqty} > maxQty {f['maxQty']} (LOT_SIZE)"

    # minNotional (only if we know a price)
    if spx is not None:
        notional = sqty * spx
        if notional < f["minNotional"]:
            return sqty, spx, f"notional {notional:.8f} < minNotional {f['minNotional']}"

    return sqty, spx, None


async def place_order(
    cli: AsyncClient,
    symbol: str,
    side: str,
    qty: float,
    prefer_maker: bool,
    limit_px: Optional[float],
):
    side_c = SIDE_BUY if side == "BUY" else SIDE_SELL

    # Snap & validate first (this is what avoids LOT_SIZE and minNotional surprises)
    qty_adj, px_adj, err = _enforce_qty_px(symbol, qty, limit_px)
    if err:
        # Let the caller surface this clearly to the UI
        raise ValueError(f"Filter check failed for {symbol}: {err}")

    # LIMIT_MAKER (no TIF)
    if prefer_maker and px_adj:
        return await cli.create_order(
            symbol=symbol,
            side=side_c,
            type=ORDER_TYPE_LIMIT_MAKER,
            quantity=qty_adj,
            price=f"{px_adj:.8f}",
            newOrderRespType="RESULT",
        )

    # Regular LIMIT (GTC)
    if px_adj:
        return await cli.create_order(
            symbol=symbol,
            side=side_c,
            type=ORDER_TYPE_LIMIT,
            quantity=qty_adj,
            price=f"{px_adj:.8f}",
            timeInForce=TIME_IN_FORCE_GTC,
            newOrderRespType="RESULT",
        )

    # MARKET
    return await cli.create_order(
        symbol=symbol,
        side=side_c,
        type=ORDER_TYPE_MARKET,
        quantity=qty_adj,
        newOrderRespType="RESULT",
    )
