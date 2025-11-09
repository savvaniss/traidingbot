export type Ticker = { symbol: string; price: number; ts: number };

export type Balance = { asset: string; free: number; locked: number };

export type Preference = {
  riskLevel: number;
  maxExposureUsd: number;
  preferMaker: boolean;
  slippageBps: number;
  timeInForce: "GTC" | "IOC" | "FOK";
  paperTrading: boolean;
};

export type StrategyConfig = {
  timeframe: "1m" | "3m" | "5m";
  minAtrPct: number;
  minAtrUsd: number;
  confirmStreak: number;
  flipCooldownSec: number;
  stopAtrMult: number;
  tpRiskMultiple: number;
};

export type Signal = {
  symbol: string;
  side: "BUY" | "SELL" | "FLAT";
  confidence: number;
  reasons: Array<{ label: string; value: string | number; weight?: number }>;
  explanation?: string;
  stopPrice?: number | null;
  takeProfit?: number | null;
  targetExposureUsd?: number | null;
  suggestedQtyBase?: number | null;
};

export type OrderPreview = {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  notionalUsd: number;
  limitPrice?: number;
  estFeesUsd: number;
  stopPrice?: number | null;
  takeProfit?: number | null;
};

/** === New: orders log entry (from /orders/recent) === */
export type OrderLogEntry = {
  t: number;             // epoch seconds (added by backend)
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  px?: number | null;    // limit price (if present) or undefined
  mode: "paper" | "live";
  resp?: unknown;        // raw binance response (optional)
};

/** === New: autotrade status === */
export type AutoTradeStatus = {
  enabled: boolean;
  symbols: string[];
};
