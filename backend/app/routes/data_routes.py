from fastapi import APIRouter, Query
from ..state import latest_prices, latest_ts, balances_cache

router = APIRouter()

@router.get("/tick")
async def tick(symbol: str = Query("BTCUSDC")):
    s = symbol.upper()
    return {"symbol": s, "price": latest_prices.get(s, 0.0), "ts": latest_ts.get(s, 0)}

@router.get("/balances")
async def balances():
    return [{"asset": a, "free": q, "locked": 0.0} for a, q in sorted(balances_cache.items())]

@router.get("/portfolio")
async def portfolio():
    stables = {"USDT","USDC","FDUSD","TUSD","DAI","USDP","BFUSD"}
    equity = 0.0
    lines = []
    for asset, qty in balances_cache.items():
        if asset in stables:
            px = 1.0
        else:
            sym = f"{asset}USDT"
            from ..state import latest_prices  # local import to avoid cycle
            px = latest_prices.get(sym, 0.0)
        usd = qty * (px or 0.0)
        equity += usd
        lines.append({"asset": asset, "qty": qty, "price": px, "usdValue": usd})
    return {"equityUsd": equity, "positions": lines}
