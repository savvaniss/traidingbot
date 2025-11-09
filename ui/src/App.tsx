import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Play, Pause, Settings, Wallet, ShieldAlert, Signal, Info, RefreshCw } from "lucide-react";

/**
 * Suggestions‑First UI for a Crypto Trading Assistant (Binance‑oriented)
 * ---------------------------------------------------------------------
 * - No auto‑trading yet. The bot computes signals and *suggests* actions.
 * - You can tweak risk and execution preferences, preview the order, and confirm manually.
 * - Market data + signals are mocked here; wire to your backend later.
 *
 * Tech decisions (per ChatGPT guidance):
 *  - Tailwind utilities (assumed available in environment)
 *  - shadcn/ui components can be swapped in later; kept minimal here
 *  - Framer Motion for subtle, polished animations
 *  - Lucide icons for quick visual cues
 */

// ---------------------------
// Types
// ---------------------------

type Ticker = {
  symbol: string;
  price: number;
  ts: number;
};

type Signal = {
  symbol: string;
  side: "BUY" | "SELL" | "FLAT";
  confidence: number; // 0..1
  reasons: Array<{ label: string; value: string | number; weight?: number }>; // Explainability
  stopPrice?: number;
  takeProfit?: number;
  targetExposureUsd?: number;
};

type Preference = {
  riskLevel: number; // 0..1 (maps to max exposure)
  maxExposureUsd: number; // absolute cap
  preferMaker: boolean; // try post‑only first
  slippageBps: number; // UI hint
  timeInForce: "GTC" | "IOC" | "FOK";
  paperTrading: boolean;
};

type OrderPreview = {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number; // in base asset
  notionalUsd: number;
  limitPrice?: number;
  estFeesUsd: number;
  stopPrice?: number;
  takeProfit?: number;
};

// ---------------------------
// Mock data generator (replace with real sockets)
// ---------------------------

function useMockTicker(symbol: string) {
  const [tick, setTick] = useState<Ticker>({ symbol, price: 68000, ts: Date.now() });
  useEffect(() => {
    const id = setInterval(() => {
      // Random walk
      setTick((t) => {
        const drift = (Math.random() - 0.5) * 50; // ±$25 per tick
        const price = Math.max(100, t.price + drift);
        return { symbol: t.symbol, price, ts: Date.now() };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [symbol]);
  return tick;
}

function useMockSignal(tick: Ticker): Signal {
  // Simple moving average crossover mock using synthetic history in ref
  const historyRef = useRef<number[]>([]);
  const [sig, setSig] = useState<Signal>({ symbol: tick.symbol, side: "FLAT", confidence: 0.0, reasons: [] });

  useEffect(() => {
    historyRef.current = [...historyRef.current.slice(-99), tick.price];
    const h = historyRef.current;
    if (h.length < 50) {
      setSig((s) => ({ ...s, symbol: tick.symbol, side: "FLAT", confidence: 0.2, reasons: [{ label: "Warm‑up", value: `${h.length}/50 bars` }] }));
      return;
    }
    const ema = (arr: number[], span: number) => {
      const k = 2 / (span + 1);
      let e = arr[0];
      for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
      return e;
    };
    const e20 = ema(h, 20);
    const e50 = ema(h, 50);
    const atr = (() => {
      // poor man ATR proxy: stddev of last N deltas * factor
      const deltas = h.slice(-50).map((x, i, a) => (i === 0 ? 0 : x - a[i - 1]));
      const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
      const varc = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, deltas.length);
      return Math.sqrt(varc) * 2.5; // USD
    })();

    const side = e20 > e50 ? "BUY" : "SELL";
    const trendStrength = Math.min(1, Math.abs(e20 - e50) / (atr || 1));
    const confidence = Math.max(0.1, Math.min(0.95, trendStrength));

    const stopPrice = side === "BUY" ? tick.price - 3 * atr : tick.price + 3 * atr;
    const takeProfit = side === "BUY" ? tick.price + 4 * atr : tick.price - 4 * atr;

    setSig({
      symbol: tick.symbol,
      side,
      confidence,
      reasons: [
        { label: "EMA20", value: e20.toFixed(2), weight: 0.4 },
        { label: "EMA50", value: e50.toFixed(2), weight: 0.3 },
        { label: "ATR proxy", value: atr.toFixed(2), weight: 0.2 },
        { label: "Trend strength", value: (trendStrength * 100).toFixed(1) + "%", weight: 0.1 },
      ],
      stopPrice,
      takeProfit,
      targetExposureUsd: 500 + 1500 * confidence,
    });
  }, [tick]);

  return sig;
}

// ---------------------------
// UI helpers
// ---------------------------

function Pill({ children, tone = "neutral" as "neutral" | "good" | "bad" }) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-800",
    good: "bg-green-100 text-green-800",
    bad: "bg-red-100 text-red-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${tones[tone]}`}>{children}</span>;
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ---------------------------
// Main App
// ---------------------------

export default function CryptoSuggestionsUI() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [pref, setPref] = useState<Preference>({
    riskLevel: 0.35,
    maxExposureUsd: 2000,
    preferMaker: true,
    slippageBps: 10,
    timeInForce: "GTC",
    paperTrading: true,
  });

  const tick = useMockTicker(symbol);
  const signal = useMockSignal(tick);

  const orderPreview: OrderPreview | null = useMemo(() => {
    if (signal.side === "FLAT") return null;
    const notional = Math.min(signal.targetExposureUsd || 0, pref.maxExposureUsd) * pref.riskLevel;
    const qty = notional / Math.max(1, tick.price);
    const feeRate = 0.0001; // 1 bps (maker) rough
    const estFeesUsd = notional * feeRate;
    const limitAdj = pref.preferMaker ? (signal.side === "BUY" ? -1 : +1) * (tick.price * pref.slippageBps / 10000) : 0;
    const limitPrice = Math.max(1, tick.price + limitAdj);
    return {
      symbol,
      side: signal.side,
      qty: Number(qty.toFixed(6)),
      notionalUsd: Number(notional.toFixed(2)),
      estFeesUsd: Number(estFeesUsd.toFixed(2)),
      limitPrice: pref.preferMaker ? Number(limitPrice.toFixed(2)) : undefined,
      stopPrice: signal.stopPrice ? Number(signal.stopPrice.toFixed(2)) : undefined,
      takeProfit: signal.takeProfit ? Number(signal.takeProfit.toFixed(2)) : undefined,
    };
  }, [signal, pref, tick.price, symbol]);

  const [connected, setConnected] = useState(false);
  useEffect(() => {
    // simulate connectivity
    const id = setTimeout(() => setConnected(true), 600);
    return () => clearTimeout(id);
  }, []);

  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!orderPreview) return;
    setSubmitting(true);
    try {
      // In MVP we just log. Replace with POST /orders to your backend.
      await new Promise((r) => setTimeout(r, 800));
      console.log("PLACE ORDER", { orderPreview, preferences: pref });
      alert(`${pref.paperTrading ? "Paper" : "Live"} order submitted: ${orderPreview.side} ${orderPreview.qty} ${orderPreview.symbol}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* Top bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-black text-white grid place-items-center font-bold">CB</div>
          <div>
            <div className="text-sm font-semibold">Crypto Assistant • Suggestions‑First</div>
            <div className="text-xs text-gray-500">Binance‑ready • No auto‑trading</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Pill tone={connected ? "good" : "bad"}>{connected ? "Connected" : "Connecting…"}</Pill>
          <Pill>{pref.paperTrading ? "Paper" : "Live"}</Pill>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
        {/* Left column: Market & Signal */}
        <div className="md:col-span-2 space-y-4">
          <Section title="Market" icon={<Activity className="w-4 h-4 text-gray-600" />}> 
            <div className="flex items-center gap-3">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm"
              >
                <option>BTCUSDT</option>
                <option>ETHUSDT</option>
                <option>BNBUSDT</option>
              </select>
              <div className="text-2xl font-semibold tabular-nums">${tick.price.toFixed(2)}</div>
              <div className="text-xs text-gray-500">{new Date(tick.ts).toLocaleTimeString()}</div>
              <button className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-gray-50">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </Section>

          <Section title="Signal & Rationale" icon={<Signal className="w-4 h-4 text-gray-600" />}> 
            <div className="flex items-start gap-4">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2"
              >
                {signal.side === "BUY" ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm font-semibold">BUY suggestion</span>
                  </div>
                ) : signal.side === "SELL" ? (
                  <div className="flex items-center gap-2 text-red-700">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-sm font-semibold">SELL suggestion</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="w-5 h-5" />
                    <span className="text-sm font-semibold">No action (FLAT)</span>
                  </div>
                )}
                <Pill tone={signal.confidence > 0.6 ? "good" : signal.confidence < 0.35 ? "bad" : "neutral"}>
                  Confidence {(signal.confidence * 100).toFixed(0)}%
                </Pill>
              </motion.div>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {signal.reasons.map((r, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">{r.label}</div>
                  <div className="text-sm font-semibold tabular-nums">{r.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-600">
              Risk guardrails suggested: {signal.stopPrice ? `Stop @ ${signal.stopPrice.toFixed(2)}` : "—"} • {signal.takeProfit ? `TP @ ${signal.takeProfit.toFixed(2)}` : "—"}
            </div>
          </Section>

          <Section title="Order Preview" icon={<Wallet className="w-4 h-4 text-gray-600" />}> 
            {!orderPreview ? (
              <div className="text-sm text-gray-600">No order suggested yet. When a signal appears, details will show here.</div>
            ) : (
              <div className="grid md:grid-cols-5 gap-3 text-sm">
                <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase text-gray-500">Side</div>
                  <div className="font-semibold">{orderPreview.side}</div>
                  <div className="text-[10px] uppercase text-gray-500 mt-2">Symbol</div>
                  <div className="font-medium">{orderPreview.symbol}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase text-gray-500">Qty (est.)</div>
                  <div className="font-semibold tabular-nums">{orderPreview.qty}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase text-gray-500">Notional (USD)</div>
                  <div className="font-semibold tabular-nums">${orderPreview.notionalUsd.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase text-gray-500">Est. fees</div>
                  <div className="font-semibold tabular-nums">${orderPreview.estFeesUsd.toFixed(2)}</div>
                </div>
                <div className="md:col-span-5 grid md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase text-gray-500">Limit price</div>
                    <div className="font-semibold tabular-nums">{orderPreview.limitPrice ? `$${orderPreview.limitPrice.toFixed(2)}` : "(market)"}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase text-gray-500">Stop</div>
                    <div className="font-semibold tabular-nums">{orderPreview.stopPrice ? `$${orderPreview.stopPrice.toFixed(2)}` : "—"}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase text-gray-500">Take profit</div>
                    <div className="font-semibold tabular-nums">{orderPreview.takeProfit ? `$${orderPreview.takeProfit.toFixed(2)}` : "—"}</div>
                  </div>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Right column: Controls */}
        <div className="space-y-4">
          <Section title="Preferences" icon={<Settings className="w-4 h-4 text-gray-600" />}> 
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="text-gray-700">Risk level</span>
                <span className="tabular-nums text-gray-600">{Math.round(pref.riskLevel * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={pref.riskLevel}
                onChange={(e) => setPref((p) => ({ ...p, riskLevel: parseFloat(e.target.value) }))}
                className="w-full"
              />

              <label className="flex items-center justify-between gap-2">
                <span className="text-gray-700">Max exposure (USD)</span>
                <input
                  type="number"
                  className="w-28 px-2 py-1 border rounded-lg"
                  value={pref.maxExposureUsd}
                  onChange={(e) => setPref((p) => ({ ...p, maxExposureUsd: Number(e.target.value || 0) }))}
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span className="text-gray-700">Prefer maker (post‑only)</span>
                <input
                  type="checkbox"
                  checked={pref.preferMaker}
                  onChange={(e) => setPref((p) => ({ ...p, preferMaker: e.target.checked }))}
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span className="text-gray-700">Slippage budget (bps)</span>
                <input
                  type="number"
                  className="w-20 px-2 py-1 border rounded-lg"
                  value={pref.slippageBps}
                  onChange={(e) => setPref((p) => ({ ...p, slippageBps: Number(e.target.value || 0) }))}
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span className="text-gray-700">Time in force</span>
                <select
                  className="px-2 py-1 border rounded-lg"
                  value={pref.timeInForce}
                  onChange={(e) => setPref((p) => ({ ...p, timeInForce: e.target.value as Preference["timeInForce"] }))}
                >
                  <option value="GTC">GTC</option>
                  <option value="IOC">IOC</option>
                  <option value="FOK">FOK</option>
                </select>
              </label>

              <label className="flex items-center justify-between gap-2">
                <span className="text-gray-700">Paper trading</span>
                <input
                  type="checkbox"
                  checked={pref.paperTrading}
                  onChange={(e) => setPref((p) => ({ ...p, paperTrading: e.target.checked }))}
                />
              </label>
            </div>
          </Section>

          <Section title="Risk Checks" icon={<ShieldAlert className="w-4 h-4 text-gray-600" />}> 
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Daily loss cap (planned)</li>
              <li>Per‑symbol exposure cap</li>
              <li>Data freshness guard</li>
              <li>Venue health checks</li>
            </ul>
          </Section>

          <Section title="Action" icon={<Play className="w-4 h-4 text-gray-600" />}> 
            <button
              onClick={handlePlaceOrder}
              disabled={!orderPreview || submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white bg-black disabled:opacity-40"
            >
              {submitting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {submitting ? "Submitting…" : orderPreview ? `Confirm ${orderPreview.side}` : "Waiting for signal"}
            </button>
            <div className="mt-2 text-[11px] text-gray-500">
              This interface suggests trades and requires your confirmation. No auto‑trading is performed.
            </div>
          </Section>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-4">
        <Section title="What’s next" icon={<Settings className="w-4 h-4 text-gray-600" />}> 
          <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
            <li>Replace the mock ticker/signal hooks with your backend WebSocket (live Binance Testnet data).</li>
            <li>Create endpoints: <code className="bg-gray-100 px-1 rounded">GET /tick</code>, <code className="bg-gray-100 px-1 rounded">GET /signal</code>, <code className="bg-gray-100 px-1 rounded">POST /orders</code>.</li>
            <li>Enable persistent storage for fills and orders, and render a trade log below the preview.</li>
            <li>Add backtest panel with CSV upload and equity curve.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}


