from fastapi import APIRouter
from ..models import ConfigIn
from ..state import config, candles
from ..config import SYMBOLS

router = APIRouter()

@router.get("/config")
async def get_config():
    return config

@router.post("/config")
async def set_config(cfg: ConfigIn):
    current = config
    changed_tf = False

    if cfg.timeframe and cfg.timeframe != current["timeframe"]:
        current["timeframe"] = cfg.timeframe
        changed_tf = True

    if cfg.minAtrPct is not None:       current["minAtrPct"] = max(0.0, float(cfg.minAtrPct))
    if cfg.minAtrUsd is not None:       current["minAtrUsd"] = max(0.0, float(cfg.minAtrUsd))
    if cfg.confirmStreak is not None:   current["confirmStreak"] = max(1, int(cfg.confirmStreak))
    if cfg.flipCooldownSec is not None: current["flipCooldownSec"] = max(0, int(cfg.flipCooldownSec))
    if cfg.stopAtrMult is not None:     current["stopAtrMult"] = max(0.1, float(cfg.stopAtrMult))
    if cfg.tpRiskMultiple is not None:  current["tpRiskMultiple"] = max(0.1, float(cfg.tpRiskMultiple))

    if changed_tf:
        for sym in SYMBOLS:
            candles[sym].clear()
    return current
