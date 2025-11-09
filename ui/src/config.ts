export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export const TESTNET =
  String(import.meta.env.VITE_TESTNET || "").toLowerCase() === "true";

// Render USDT pairs on testnet, USDC on live
export const SYMBOLS = TESTNET
  ? ["BTCUSDT","ETHUSDT","BNBUSDT","DOGEUSDT","HBARUSDT","XLMUSDT","SOLUSDT","XRPUSDT"]
  : ["BTCUSDC","ETHUSDC","BNBUSDC","DOGEUSDC","HBARUSDC","XLMUSDC","SOLUSDC","XRPUSDC"];
