// src/App.tsx (compact v1 — fixed orderPreview + aligned layout)
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronDown,
  Info,
  RefreshCw,
  ShieldAlert,
  Signal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { BACKEND_URL, SYMBOLS } from "./config";
import type { OrderPreview, Preference } from "./types";

import useTicker from "./hooks/useTicker";
import useSignal from "./hooks/useSignal";
import useBalances from "./hooks/useBalances";
import useStrategyConfig from "./hooks/useStrategyConfig";
import useOrdersRecent from "./hooks/useOrdersRecent";

import Section from "./components/Section";
import StatBox from "./components/StatBox";
import PreferencesPanel from "./components/PreferencesPanel";
import StrategyForm from "./components/StrategyForm";
import BalancesTable from "./components/BalancesTable";
import OrderPreviewCard from "./components/OrderPreviewCard";
import ActionBar from "./components/ActionBar";
import AutoTradePanel from "./components/AutoTradePanel";
import OrdersTable from "./components/OrdersTable";

type Tab = "trade" | "bot" | "activity";

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const base = "px-3 py-1.5 rounded-lg text-xs font-medium border transition";
  const active = "bg-black text-white border-black";
  const idle = "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
  return (
    <div className="flex gap-2">
      {(["trade", "bot", "activity"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`${base} ${tab === t ? active : idle}`}
        >
          {t === "trade" ? "Trade" : t === "bot" ? "Bot" : "Activity"}
        </button>
      ))}
    </div>
  );
}

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="w-full rounded-xl border border-gray-200 overflow-hidden bg-white/60">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm"
        onClick={() => setOpen((s) => !s)}
      >
        <span className="font-semibold text-gray-800">{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [tab, setTab] = useState<Tab>("trade");

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
  const { orders } = useOrdersRecent(50, 2000);

  // --- FIX: robust preview even when strategy omits targetExposureUsd ---
  const orderPreview = useMemo<OrderPreview | null>(() => {
    if (!signal || signal.side === "FLAT") return null;

    const price = Number(tick.price || 0);
    if (!isFinite(price) || price <= 0) return null;

    let qty = Number(signal.suggestedQtyBase ?? 0);

    if (!qty || qty <= 0) {
      const exposureBase = signal.targetExposureUsd ?? pref.maxExposureUsd;
      const cap = Math.min(exposureBase, pref.maxExposureUsd);
      const targetExposure = cap * pref.riskLevel;
      if (!isFinite(targetExposure) || targetExposure <= 0) return null;
      qty = targetExposure / price;
    }

    const notional = qty * price;
    const feeRate = 0.0001;
    const estFeesUsd = notional * feeRate;

    const limitAdjBps = pref.preferMaker ? pref.slippageBps : 0;
    const limitAdj =
      ((signal.side === "BUY" ? -1 : +1) * price * limitAdjBps) / 10000;
    const limitPrice = pref.preferMaker ? Math.max(0.01, price + limitAdj) : undefined;

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
      await res.json();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
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
      {/* Top bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-black text-white grid place-items-center font-bold">
            CB
          </div>
          <div className="flex items-center gap-2">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="text-xl font-semibold tabular-nums">
              {tick.price ? `$${tick.price.toFixed(2)}` : "—"}
            </div>
            <div className="text-xs text-gray-500">
              {tick.ts ? new Date(tick.ts).toLocaleTimeString() : ""}
            </div>
            <button
              className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
              onClick={() => window.location.reload()}
              title="Hard refresh"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Tabs tab={tab} setTab={setTab} />
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {connected ? "Connected" : "Connecting…"}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
            {pref.paperTrading ? "Paper" : "Live"}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* TRADE TAB */}
        {tab === "trade" && (
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            {/* LEFT */}
            <div className="min-w-0 space-y-4">
              <Section title="Signal" icon={<Signal className="w-4 h-4 text-gray-600" />}>
                <div className="flex items-center gap-3">
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
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
                  </motion.div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
                    Confidence {isFinite(signal.confidence) ? Math.round(signal.confidence * 100) : 0}%
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-stretch">
                  {(signal.reasons || []).slice(0, 8).map((r, i) => (
                    <StatBox key={i} label={r.label} value={String(r.value)} />
                  ))}
                </div>

                <div className="mt-3 text-xs text-gray-600">
                  Risk guardrails suggested:{" "}
                  {signal.stopPrice ? `Stop @ $${Number(signal.stopPrice).toFixed(2)}` : "—"} •{" "}
                  {signal.takeProfit ? `TP @ $${Number(signal.takeProfit).toFixed(2)}` : "—"}
                </div>
              </Section>

              <Collapsible title="Strategy" defaultOpen={false}>
                <StrategyForm cfg={cfg} updateCfg={updateCfg} />
              </Collapsible>

              <OrderPreviewCard preview={orderPreview} ribbon={ribbon} />
            </div>

            {/* RIGHT */}
            <div className="min-w-0 space-y-4">
              <PreferencesPanel pref={pref} setPref={setPref} />
              <Collapsible title="Risk Checks" defaultOpen={false}>
                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Daily loss cap (planned)</li>
                  <li>Per-symbol exposure cap</li>
                  <li>Data freshness guard</li>
                  <li>Venue health checks</li>
                </ul>
              </Collapsible>
            </div>

            {/* Action bar spans full width */}
            <div className="lg:col-span-2 sticky bottom-3 z-10">
              <ActionBar
                disabled={!orderPreview || submitting}
                submitting={submitting}
                onClick={handlePlaceOrder}
                label={orderPreview ? `Confirm ${orderPreview.side}` : "Waiting for signal"}
              />
            </div>
          </div>
        )}

        {/* BOT TAB */}
        {tab === "bot" && (
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              <Section title="Auto-Trade (bot)" icon={<Activity className="w-4 h-4 text-gray-600" />}>
                <AutoTradePanel />
              </Section>
              <Section title="Recent Bot Orders">
                <OrdersTable orders={orders} />
              </Section>
            </div>
            <div className="min-w-0 space-y-4">
              <PreferencesPanel pref={pref} setPref={setPref} />
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === "activity" && (
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              <Section title="Orders">
                <OrdersTable orders={orders} />
              </Section>
            </div>
            <div className="min-w-0 space-y-4">
              <Section title="Balances">
                <BalancesTable balances={balances} />
              </Section>
              <Section title="Risk Checks" icon={<ShieldAlert className="w-4 h-4 text-gray-600" />}>
                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Daily loss cap (planned)</li>
                  <li>Per-symbol exposure cap</li>
                  <li>Data freshness guard</li>
                </ul>
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
