import time
from collections import deque
from typing import Dict, Deque, Tuple, List, Set, Any
from .config import SYMBOLS, CANDLE_MAX, DEFAULT_CONFIG

# per-symbol OHLC buffers
candles: Dict[str, Deque[Tuple[float,float,float,float]]] = {
    s: deque(maxlen=CANDLE_MAX) for s in SYMBOLS
}

# flip/hysteresis state
signal_state = { s: {"side":"FLAT","last_flip":0,"streak":0} for s in SYMBOLS }

# last trade px/ts
latest_prices: Dict[str, float] = {s: 0.0 for s in SYMBOLS}
latest_ts: Dict[str, int]       = {s: 0 for s in SYMBOLS}

# balances cache
balances_cache: Dict[str, float] = {}

# live config (mutable)
config = DEFAULT_CONFIG.copy()

# autotrade controls
autotrade_enabled: bool = False
autotrade_symbols: Set[str] = set()

# simple order log (paper + live)
order_log: List[Dict[str, Any]] = []   # append dicts with time,symbol,side,qty,px,mode,resp
ORDER_LOG_MAX = 500

def log_order(entry: Dict[str, Any]):
    entry["t"] = int(time.time())
    order_log.append(entry)
    if len(order_log) > ORDER_LOG_MAX:
        del order_log[: len(order_log) - ORDER_LOG_MAX]
