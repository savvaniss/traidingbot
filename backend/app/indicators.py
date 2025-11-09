from typing import List, Optional

def ema(series: List[float], length: int) -> Optional[float]:
    if len(series) < length:
        return None
    k = 2 / (length + 1)
    e = series[-length]
    for v in series[-length+1:]:
        e = v * k + e * (1 - k)
    return e

def atr(highs: List[float], lows: List[float], closes: List[float], length: int) -> Optional[float]:
    if len(closes) < length + 1:
        return None
    trs = []
    for i in range(-length, 0):
        h, l, cprev = highs[i], lows[i], closes[i-1]
        trs.append(max(h - l, abs(h - cprev), abs(l - cprev)))
    return sum(trs) / len(trs)
