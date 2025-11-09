import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Play,
  Pause,
  Settings,
  Wallet,
  ShieldAlert,
  Signal,
  Info,
  RefreshCw,
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

/* ================= Types ================= */

type Ticker = { symbol: string; price: number; ts: number };
type Signal = {
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
type Preference = {
  riskLevel: number;
  maxExposureUsd: number;
  preferMaker: boolean;
  slippageBps: number;
  timeInForce: "GTC" | "IOC" | "FOK";
  paperTrading: boolean;
};
type OrderPreview = {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  notionalUsd: number;
  limitPrice?: number;
  estFeesUsd: number;
  stopPrice?: number | null;
  takeProfit?: number | null;
};
type StrategyConfig = {
  timeframe: "1m" | "3m" | "5m";
  minAtrPct: number;
  minAtrUsd: number;
  confirmStreak: number;
  flipCooldownSec: number;
  stopAtrMult: number;
  tpRiskMultiple: number;
};
type Balance = { asset: string; free: number; locked: number };

/* ================= Hooks ================= */

function useStrategyConfig() {
  const [cfg, setCfg] = useState<StrategyConfig>({
    timeframe: "1m",
    minAtrPct: 0.02,
    minAtrUsd: 8.0,
    confirmStreak: 2,
    flipCooldownSec: 120,
    stopAtrMult: 1.5,
    tpRiskMultiple: 2.0,
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/config`);
        if (r.ok) setCfg(await r.json());
      } catch {}
    })();
  }, []);

  const update = async (patch: Partial<StrategyConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try {
      await fetch(`${BACKEND_URL}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {}
  };

  return [cfg, update] as const;
}

function useBinanceTicker(symbol: string) {
  const [tick, setTick] = useState<Ticker>({ symbol, price: 0, ts: 0 });
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/tick?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error(`tick ${res.status}`);
        const d = await res.json();
        if (!cancelled) setTick({ symbol, price: Number(d.price || 0), ts: Number(d.ts || 0) });
      } catch {
        if (!cancelled) setTick((t) => ({ ...t }));
      }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);
  return tick;
}

function useBinanceSignal(symbol: string, riskLevel: number, maxExposureUsd: number) {
  const [signal, setSignal] = useState<Signal>({ symbol, side: "FLAT", confidence: 0, reasons: [] });
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const params = new URLSearchParams({
          symbol,
          riskLevel: String(riskLevel),
          maxExposureUsd: String(maxExposureUsd),
        });
        const res = await fetch(`${BACKEND_URL}/signal?` + params.toString());
        if (!res.ok) throw new Error(`signal ${res.status}`);
        const d = await res.json();
        if (!cancelled) setSignal(d);
      } catch {
        if (!cancelled) setSignal((s) => ({ ...s, side: "FLAT", confidence: 0 }));
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, riskLevel, maxExposureUsd]);
  return signal;
}

function useBalances() {
  const [balances, setBalances] = useState<Balance[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/balances`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setBalances(data);
      } catch {
        if (!cancelled) setBalances([]);
      }
    };
    fetchBalances();
    const id = setInterval(fetchBalances, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return balances;
}

/* ================= UI helpers ================= */

function Help({ tip }: { tip: string }) {
  return (
    <span title={tip} aria-label={tip} className="inline-flex items-center cursor-help text-gray-400 hover:text-gray-600">
      <Info className="w-3.5 h-3.5" />
    </span>
  );
}

function Pill({ children, tone = "neutral" as "neutral" | "good" | "bad" }) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-800",
    good: "bg-green-100 text-green-800",
    bad: "bg-red-100 text-red-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${tones[tone]}`}>{children}</span>;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
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

/* ================= Main ================= */

export default function CryptoSuggestionsUI() {
  const [symbol, setSymbol] = useState("BTCUSDC");
  const [pref, setPref] = useState<Preference>({
    riskLevel: 0.35,
    maxExposureUsd: 2000,
    preferMaker: true,
    slippageBps: 10,
    timeInForce: "GTC",
    paperTrading: true,
  });
  const [cfg, updateCfg] = useStrategyConfig();

  const tick = useBinanceTicker(symbol);
  const signal = useBinanceSignal(symbol, pref.riskLevel, pref.maxExposureUsd);
  const balances = useBalances();

  const orderPreview: OrderPreview | null = useMemo(() => {
    if (!signal || signal.side === "FLAT" || !tick.price) return null;

    let qty = Number(signal.suggestedQtyBase || 0);
    let notional = qty * tick.price;

    if (!qty || qty <= 0) {
      const targetExposure =
        Math.min(signal.targetExposureUsd || 0, pref.maxExposureUsd) * pref.riskLevel;
      if (targetExposure <= 0) return null;
      qty = targetExposure / Math.max(1, tick.price);
      notional = targetExposure;
    }

    const feeRate = 0.0001;
    const estFeesUsd = notional * feeRate;
    const limitAdj = pref.preferMaker
      ? (signal.side === "BUY" ? -1 : +1) * (tick.price * pref.slippageBps) / 10000
      : 0;
    const limitPrice = pref.preferMaker ? Math.max(1, tick.price + limitAdj) : undefined;

    return {
      symbol,
      side: signal.side as "BUY" | "SELL",
      qty: Number(qty.toFixed(6)),
      notionalUsd: Number(notional.toFixed(2)),
      estFeesUsd: Number(estFeesUsd.toFixed(2)),
      limitPrice: limitPrice ? Number(limitPrice.toFixed(2)) : undefined,
      stopPrice: signal.stopPrice ?? null,
      takeProfit: signal.takeProfit ?? null,
    };
  }, [signal, pref, tick.price, symbol]);

  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setConnected(true), 600);
    return () => clearTimeout(id);
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const handlePlaceOrder = async () => {
    if (!orderPreview) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...orderPreview,
          tif: pref.timeInForce,
          preferMaker: pref.preferMaker,
          paperTrading: pref.paperTrading,
        }),
      });
      if (!res.ok) throw new Error(`orders ${res.status}`);
      const data = await res.json();
      console.log("ORDER RESPONSE", data);
      alert(
        `${pref.paperTrading ? "Paper" : "Live"} order submitted: ${orderPreview.side} ${orderPreview.qty} ${orderPreview.symbol}`
      );
    } catch (e: any) {
      alert(`Order failed: ${e?.message || e}`);
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
            <div className="text-sm font-semibold">Crypto Assistant • Suggestions-First</div>
            <div className="text-xs text-gray-500">Binance-ready • Backend: {BACKEND_URL}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Pill tone={connected ? "good" : "bad"}>{connected ? "Connected" : "Connecting…"} </Pill>
          <Pill>{pref.paperTrading ? "Paper" : "Live"}</Pill>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="md:col-span-2 space-y-4">
          <Section title="Market" icon={<Activity className="w-4 h-4 text-gray-600" />}>
            <div className="flex items-center gap-3">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm"
              >
                <option>BTCUSDC</option>
                <option>ETHUSDC</option>
                <option>BNBUSDC</option>
                <option>DOGEUSDC</option>
                <option>HBARUSDC</option>
                <option>XLMUSDC</option>
                <option>XRPUSDC</option>
              </select>
              <div className="text-2xl font-semibold tabular-nums">
                {tick.price ? `$${tick.price.toFixed(2)}` : "—"}
              </div>
              <div className="text-xs text-gray-500">{tick.ts ? new Date(tick.ts).toLocaleTimeString() : ""}</div>
              <button
                className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </Section>

          <Section title="Signal & Rationale" icon={<Signal className="w-4 h-4 text-gray-600" />}>
            <div className="flex items-start gap-4">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
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
                  Confidence {isFinite(signal.confidence) ? Math.round(signal.confidence * 100) : 0}%
                </Pill>
              </motion.div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 [grid-auto-rows:1fr]">
              {(signal.reasons || []).map((r, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-2 h-full min-h-[72px]">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">{r.label}</div>
                  <div className="text-sm font-semibold tabular-nums">{String(r.value)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-gray-600">
              Risk guardrails suggested:{" "}
              {signal.stopPrice ? `Stop @ $${Number(signal.stopPrice).toFixed(2)}` : "—"} •{" "}
              {signal.takeProfit ? `TP @ $${Number(signal.takeProfit).toFixed(2)}` : "—"}
            </div>
          </Section>

          <Section title="Strategy" icon={<Settings className="w-4 h-4 text-gray-600" />}>
            {/* use a 2-column grid so the right edge is perfectly aligned */}
            <div className="space-y-3 text-sm">
              {/** Row helper to reduce repetition */}
              <Row
                label={
                  <>
                    Timeframe <Help tip="Resolution of candles used for signals (closed bars only). Higher = fewer, stronger signals; lower = more reactive." />
                  </>
                }
                control={
                  <select
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.timeframe}
                    onChange={(e) => updateCfg({ timeframe: e.target.value as StrategyConfig["timeframe"] })}
                  >
                    <option value="1m">1 minute</option>
                    <option value="3m">3 minutes</option>
                    <option value="5m">5 minutes</option>
                  </select>
                }
              />

              <Row
                label={
                  <>
                    Min ATR % <Help tip="Volatility filter: average true range as a percentage of price. If ATR% is below this, we stay FLAT to avoid chop." />
                  </>
                }
                control={
                  <input
                    type="number"
                    step={0.005}
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.minAtrPct}
                    onChange={(e) => updateCfg({ minAtrPct: Number(e.target.value || 0) })}
                  />
                }
              />

              <Row
                label={
                  <>
                    Min ATR (USD){" "}
                    <Help tip="Absolute volatility floor in dollars. Both ATR% AND ATR(USD) must be low to block trades; this prevents false FLAT on high-priced assets." />
                  </>
                }
                control={
                  <input
                    type="number"
                    step={0.5}
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.minAtrUsd}
                    onChange={(e) => updateCfg({ minAtrUsd: Number(e.target.value || 0) })}
                  />
                }
              />

              <Row
                label={
                  <>
                    Confirm streak <Help tip="Hysteresis: number of consecutive bars the new side must persist before flipping (reduces ping-pong)." />
                  </>
                }
                control={
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.confirmStreak}
                    onChange={(e) => updateCfg({ confirmStreak: Number(e.target.value || 1) })}
                  />
                }
              />

              <Row
                label={
                  <>
                    Flip cooldown (sec) <Help tip="Minimum seconds to wait after a side change before allowing another flip (prevents over-trading)." />
                  </>
                }
                control={
                  <input
                    type="number"
                    min={0}
                    step={10}
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.flipCooldownSec}
                    onChange={(e) => updateCfg({ flipCooldownSec: Number(e.target.value || 0) })}
                  />
                }
              />

              <Row
                label={
                  <>
                    Stop ATR× <Help tip="Stop-loss distance in ATR units. BUY: entry − ATR×x. SELL: entry + ATR×x." />
                  </>
                }
                control={
                  <input
                    type="number"
                    step={0.1}
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.stopAtrMult}
                    onChange={(e) => updateCfg({ stopAtrMult: Number(e.target.value || 0) })}
                  />
                }
              />

              <Row
                label={
                  <>
                    TP R-multiple <Help tip="Take-profit distance as a multiple of risk (R). If R = entry − stop, TP = entry ± R×this." />
                  </>
                }
                control={
                  <input
                    type="number"
                    step={0.1}
                    className="px-2 py-1 border rounded-lg w-32"
                    value={cfg.tpRiskMultiple}
                    onChange={(e) => updateCfg({ tpRiskMultiple: Number(e.target.value || 0) })}
                  />
                }
              />
            </div>
          </Section>

          <Section title="Order Preview" icon={<Wallet className="w-4 h-4 text-gray-600" />}>
            {!orderPreview ? (
              <div className="text-sm text-gray-600">
                No order suggested yet. When a signal appears, details will show here.
              </div>
            ) : (
              <>
                <div className="mb-3 text-xs text-gray-700">
                  <span className="px-2 py-1 rounded bg-gray-100 border border-gray-200">
                    SL: {signal.stopPrice ? `$${Number(signal.stopPrice).toFixed(2)}` : "—"} •{" "}
                    TP: {signal.takeProfit ? `$${Number(signal.takeProfit).toFixed(2)}` : "—"}
                  </span>
                </div>

                {/* Top row */}
                <div className="grid md:grid-cols-5 gap-3 text-sm [grid-auto-rows:1fr]">
                  <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Side</div>
                    <div className="font-semibold">{orderPreview.side}</div>
                    <div className="text-[10px] uppercase text-gray-500 mt-2">Symbol</div>
                    <div className="font-medium">{orderPreview.symbol}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Qty (est.)</div>
                    <div className="font-semibold tabular-nums">{orderPreview.qty}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Notional (USD)</div>
                    <div className="font-semibold tabular-nums">${orderPreview.notionalUsd.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Est. fees</div>
                    <div className="font-semibold tabular-nums">${orderPreview.estFeesUsd.toFixed(2)}</div>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="mt-3 grid md:grid-cols-3 gap-3 [grid-auto-rows:1fr]">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Limit price</div>
                    <div className="font-semibold tabular-nums">
                      {orderPreview.limitPrice ? `$${orderPreview.limitPrice.toFixed(2)}` : "(market)"}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Stop</div>
                    <div className="font-semibold tabular-nums">
                      {orderPreview.stopPrice ? `$${Number(orderPreview.stopPrice).toFixed(2)}` : "—"}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full min-h-[96px]">
                    <div className="text-[10px] uppercase text-gray-500">Take profit</div>
                    <div className="font-semibold tabular-nums">
                      {orderPreview.takeProfit ? `$${Number(orderPreview.takeProfit).toFixed(2)}` : "—"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Section>
        </div>

        {/* Right column */}
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
                <span className="text-gray-700">Prefer maker (post-only)</span>
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
                  onChange={(e) =>
                    setPref((p) => ({ ...p, timeInForce: e.target.value as Preference["timeInForce"] }))
                  }
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

          <Section title="Balances" icon={<Wallet className="w-4 h-4 text-gray-600" />}>
            {balances.length === 0 ? (
              <div className="text-sm text-gray-600">No balances or failed to fetch.</div>
            ) : (
              <div className="max-h-64 overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-gray-500 text-xs text-left">
                      <th className="px-3 py-1">Asset</th>
                      <th className="px-3 py-1">Free</th>
                      <th className="px-3 py-1">Locked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="px-3 py-1">{b.asset}</td>
                        <td className="px-3 py-1 tabular-nums">{Number(b.free).toFixed(6)}</td>
                        <td className="px-3 py-1 tabular-nums">{Number(b.locked).toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Risk Checks" icon={<ShieldAlert className="w-4 h-4 text-gray-600" />}>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Daily loss cap (planned)</li>
              <li>Per-symbol exposure cap</li>
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
              This interface suggests trades and requires your confirmation. No auto-trading is performed.
            </div>
          </Section>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-4">
        <Section title="What’s next" icon={<Settings className="w-4 h-4 text-gray-600" />}>
          <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
            <li>
              Ensure FastAPI backend is running at <code className="bg-gray-100 px-1 rounded">{BACKEND_URL}</code>.
            </li>
            <li>
              Set <code className="bg-gray-100 px-1 rounded">VITE_BACKEND_URL</code> in a <code>.env</code> if you need a
              different host/port.
            </li>
            <li>Next upgrade: EMA/ATR signals + Binance filter snapping (lot size, minNotional).</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

/* Reusable row for Strategy section with aligned controls */
function Row({
  label,
  control,
}: {
  label: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_8rem] items-center gap-3">
      <span className="text-gray-700 inline-flex items-center gap-1">{label}</span>
      <div className="flex justify-end">{control}</div>
    </div>
  );
}
