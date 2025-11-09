from typing import Optional, List
from pydantic import BaseModel

class OrderIn(BaseModel):
    symbol: str
    side: str
    qty: float
    limitPrice: Optional[float] = None
    tif: str = "GTC"
    preferMaker: bool = True
    paperTrading: bool = True

class ConfigIn(BaseModel):
    timeframe: Optional[str] = None
    minAtrPct: Optional[float] = None
    minAtrUsd: Optional[float] = None
    confirmStreak: Optional[int] = None
    flipCooldownSec: Optional[int] = None
    stopAtrMult: Optional[float] = None
    tpRiskMultiple: Optional[float] = None

class AutoCfgIn(BaseModel):
    enabled: Optional[bool] = None
    symbols: Optional[List[str]] = None
