from fastapi import APIRouter
from ..models import AutoCfgIn
from ..config import SYMBOLS
from ..state import autotrade_enabled, autotrade_symbols

router = APIRouter()

@router.get("/autotrade")
async def get_autotrade():
    return {"enabled": autotrade_enabled, "symbols": sorted(list(autotrade_symbols))}

@router.post("/autotrade")
async def set_autotrade(cfg: AutoCfgIn):
    global autotrade_enabled, autotrade_symbols
    if cfg.enabled is not None:
        autotrade_enabled = bool(cfg.enabled)
    if cfg.symbols is not None:
        autotrade_symbols = {s.upper() for s in cfg.symbols if s.upper() in SYMBOLS}
    return {"enabled": autotrade_enabled, "symbols": sorted(list(autotrade_symbols))}
