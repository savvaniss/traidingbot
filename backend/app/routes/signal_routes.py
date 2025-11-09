from fastapi import APIRouter, Query
from ..state import config, balances_cache
from ..strategy import compute_signal

router = APIRouter()

@router.get("/signal")
async def signal(
    symbol: str = Query("BTCUSDC"),
    riskLevel: float = Query(0.35, ge=0.0, le=1.0),
    maxExposureUsd: float = Query(2000.0, ge=0.0),
):
    return compute_signal(symbol, float(riskLevel), float(maxExposureUsd), config, balances_cache)
