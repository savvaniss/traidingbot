// src/components/AutoTradePanel.tsx
import React, { useEffect, useState } from "react";
import { BACKEND_URL, SYMBOLS as DEFAULT_SYMBOLS } from "../config";
import type { AutoTradeStatus } from "../types";

// ❌ remove the hardcoded USDC list
// const ALL = [...]

export default function AutoTradePanel({ symbols = DEFAULT_SYMBOLS }: {
  symbols?: string[];
}) {
  const [status, setStatus] = useState<AutoTradeStatus>({ enabled: false, symbols: [] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/autotrade`);
      const data = await res.json();

      // guard: keep only symbols that exist in current UI set
      const filtered = (data.symbols ?? []).filter((s: string) => symbols.includes(s));
      setStatus({ enabled: !!data.enabled, symbols: filtered });
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [symbols.join(",")]);

  const post = async (next: Partial<AutoTradeStatus>) => {
    const body = JSON.stringify({
      enabled: next.enabled ?? status.enabled,
      symbols: next.symbols ?? status.symbols,
    });
    const res = await fetch(`${BACKEND_URL}/autotrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    const filtered = (data.symbols ?? []).filter((s: string) => symbols.includes(s));
    setStatus({ enabled: !!data.enabled, symbols: filtered });
  };

  const toggle = async () => {
    setSaving(true);
    try { await post({ enabled: !status.enabled }); } finally { setSaving(false); }
  };

  const toggleSymbol = async (sym: string) => {
    const next = status.symbols.includes(sym)
      ? status.symbols.filter(s => s !== sym)
      : [...status.symbols, sym];
    setSaving(true);
    try { await post({ symbols: next }); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Auto-Trade (bot)</h3>
        <button
          onClick={toggle}
          disabled={saving}
          className={`px-3 py-1 rounded-lg text-sm ${status.enabled ? "bg-red-600 text-white" : "bg-black text-white"}`}
        >
          {status.enabled ? "Stop" : "Start"}
        </button>
      </div>

      <div className="text-xs text-gray-600 mb-2">Select symbols to include in the bot’s loop:</div>

      <div className="flex flex-wrap gap-2">
        {symbols.map(sym => {
          const active = status.symbols.includes(sym);
          return (
            <button
              key={sym}
              onClick={() => toggleSymbol(sym)}
              disabled={saving}
              className={`px-2 py-1 rounded-lg text-xs border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
            >
              {sym}
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        Status:{" "}
        <span className={`font-medium ${status.enabled ? "text-green-700" : "text-gray-700"}`}>
          {status.enabled ? "Running" : "Idle"}
        </span>
        {" • "}Selected: {status.symbols.length ? status.symbols.join(", ") : "—"}
      </div>
    </div>
  );
}
