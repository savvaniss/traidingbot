// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Info, RefreshCw, ShieldAlert, Signal,
  TrendingDown, TrendingUp
} from "lucide-react";

import { BACKEND_URL } from "./config";
import type { OrderPreview, Preference } from "./types";

import useTicker from "./hooks/useTicker";
import useSignal from "./hooks/useSignal";
import useBalances from "./hooks/useBalances";
import useStrategyConfig from "./hooks/useStrategyConfig";

import Section from "./components/Section";
import StatBox from "./components/StatBox";
import PreferencesPanel from "./components/PreferencesPanel";
import StrategyForm from "./components/StrategyForm";
import BalancesTable from "./components/BalancesTable";
import OrderPreviewCard from "./components/OrderPreviewCard";
import ActionBar from "./components/ActionBar";

export default function App() {
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

  const tick = useTicker(symbol);
  const signal = useSignal(symbol, pref.riskLevel, pref.maxExposureUsd);
  const balances = useBalances();

  const orderPreview = useMemo<OrderPreview | null>(() => {
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
      ? (signal.side === "BUY" ? -1 : +1) * (tick.price * pref.slippageBps / 10000)
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
  useEffect(() => { const id = setTimeout(() => setConnected(true), 600); return () => clearTimeout(id); }, []);
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
      alert(`${pref.paperTrading ? "Paper" : "Live"} order submitted: ${orderPreview.side} ${orderPreview.qty} ${orderPreview.symbol}`);
    } catch (e: any) {
      alert(`Order failed: ${e?.message || e}`);
    } finally { setSubmitting(false); }
  };

  const ribbon = orderPreview ? (
    <div className="mb-3 text-xs text-gray-700">
      <span className="px-2 py-1 rounded bg-gray-100 border border-gray-200">
        SL: {signal.stopPrice ? `$${Number(signal.stopPrice).toFixed(2)}` : "—"} •{" "}
        TP: {signal.takeProfit ? `$${Number(signal.takeProfit).toFixed(2)}` : "—"}
      </span>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* top bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-black text-white grid place-items-center font-bold">CB</div>
          <div>
            <div className="text-sm font-semibold">Crypto Assistant • Suggestions-First</div>
            <div className="text-xs text-gray-500">Binance-ready • Backend: {BACKEND_URL}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full text-xs ${connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {connected ? "Connected" : "Connecting…"}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
            {pref.paperTrading ? "Paper" : "Live"}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 items-stretch">
        {/* left column */}
        <div className="md:col-span-2 space-y-4">
          <Section title="Market" icon={<Activity className="w-4 h-4 text-gray-600" />}>
            <div className="flex items-center gap-3">
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="px-3 py-2 border rounded-xl text-sm">
                <option>BTCUSDC</option><option>ETHUSDC</option><option>BNBUSDC</option>
                <option>DOGEUSDC</option><option>HBARUSDC</option><option>XLMUSDC</option><option>XRPUSDC</option>
              </select>
              <div className="text-2xl font-semibold tabular-nums">{tick.price ? `$${tick.price.toFixed(2)}` : "—"}</div>
              <div className="text-xs text-gray-500">{tick.ts ? new Date(tick.ts).toLocaleTimeString() : ""}</div>
              <button className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
                onClick={() => window.location.reload()}>
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </Section>

          <Section title="Signal & Rationale" icon={<Signal className="w-4 h-4 text-gray-600" />}>
            <div className="flex items-start gap-4">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                {signal.side === "BUY" ? (
                  <div className="flex items-center gap-2 text-green-700"><TrendingUp className="w-5 h-5" /><span className="text-sm font-semibold">BUY suggestion</span></div>
                ) : signal.side === "SELL" ? (
                  <div className="flex items-center gap-2 text-red-700"><TrendingDown className="w-5 h-5" /><span className="text-sm font-semibold">SELL suggestion</span></div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600"><Info className="w-5 h-5" /><span className="text-sm font-semibold">No action (FLAT)</span></div>
                )}
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
                  Confidence {isFinite(signal.confidence) ? Math.round(signal.confidence * 100) : 0}%
                </span>
              </motion.div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-stretch">
              {(signal.reasons || []).slice(0, 8).map((r, i) => (
                <StatBox key={i} label={r.label} value={String(r.value)} />
              ))}
            </div>

            <div className="mt-3 text-xs text-gray-600">
              Risk guardrails suggested: {signal.stopPrice ? `Stop @ $${Number(signal.stopPrice).toFixed(2)}` : "—"} • {signal.takeProfit ? `TP @ $${Number(signal.takeProfit).toFixed(2)}` : "—"}
            </div>
          </Section>

          <StrategyForm cfg={cfg} updateCfg={updateCfg} />
          <OrderPreviewCard preview={orderPreview} ribbon={ribbon} />
        </div>

        {/* right column */}
        <div className="space-y-4">
          <PreferencesPanel pref={pref} setPref={setPref} />
          <BalancesTable balances={balances} />
          <Section title="Risk Checks" icon={<ShieldAlert className="w-4 h-4 text-gray-600" />}>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Daily loss cap (planned)</li>
              <li>Per-symbol exposure cap</li>
              <li>Data freshness guard</li>
              <li>Venue health checks</li>
            </ul>
          </Section>
          <ActionBar
            disabled={!orderPreview || submitting}
            submitting={submitting}
            onClick={handlePlaceOrder}
            label={orderPreview ? `Confirm ${orderPreview.side}` : "Waiting for signal"}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-4">
        <Section title="What’s next" icon={<Signal className="w-4 h-4 text-gray-600" />}>
          <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
            <li>Ensure FastAPI backend is running at <code className="bg-gray-100 px-1 rounded">{BACKEND_URL}</code>.</li>
            <li>Set <code className="bg-gray-100 px-1 rounded">VITE_BACKEND_URL</code> in a <code>.env</code> file if needed.</li>
            <li>Next: snap qty/price to Binance filters (lot size / minNotional).</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}
