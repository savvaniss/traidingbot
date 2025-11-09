import os
from dotenv import load_dotenv

load_dotenv()

USE_TESTNET = True
BIN_KEY = os.getenv("BINANCE_KEY_TESTNET")
BIN_SEC = os.getenv("BINANCE_SEC_TESTNET")

# Symbols you watch/trade
SYMBOLS = [
    "BTCUSDC","ETHUSDC","BNBUSDC","DOGEUSDC",
    "HBARUSDC","XLMUSDC","SOLUSDC","XRPUSDC"
]

# Keep ~5h of 1m candles
CANDLE_MAX = 300

# EMA/ATR params
EMA_FAST = 20
EMA_SLOW = 50
ATR_LEN  = 14

DEFAULT_CONFIG = {
    "timeframe": "1m",
    "minAtrPct": 0.02,
    "minAtrUsd": 8.0,
    "confirmStreak": 2,
    "flipCooldownSec": 120,
    "stopAtrMult": 1.5,
    "tpRiskMultiple": 2.0,
}
