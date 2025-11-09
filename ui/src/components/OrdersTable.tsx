// ui/src/components/OrdersTable.tsx
import React, { useState } from "react";
import type { OrderLogEntry } from "../types";
import { BACKEND_URL } from "../config";

function fmtTs(t?: number, ts?: number) {
  const ms = ts ?? (t ? t * 1000 : undefined);
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return String(ms);
  }
}

function canCancel(o: OrderLogEntry) {
  const s = (o.status || "").toUpperCase();
  return o.mode === "live" && !!o.orderId && (s === "NEW" || s === "PARTIALLY_FILLED");
}

export default function OrdersTable({ orders }: { orders: OrderLogEntry[] }) {
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  if (!orders || orders.length === 0)
    return <div className="text-sm text-gray-600">No bot orders yet.</div>;

  const setRowBusy = (i: number, v: boolean) => setBusy((b) => ({ ...b, [i]: v }));

  const doRefresh = async (i: number, o: OrderLogEntry) => {
    if (!o.orderId || !o.symbol) return;
    setRowBusy(i, true);
    try {
      await fetch(`${BACKEND_URL}/orders/status?symbol=${o.symbol}&orderId=${o.orderId}`);
    } finally {
      setRowBusy(i, false);
    }
  };

  const doCancel = async (i: number, o: OrderLogEntry) => {
    if (!canCancel(o)) return;
    setRowBusy(i, true);
    try {
      await fetch(`${BACKEND_URL}/orders/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: o.symbol, orderId: o.orderId }),
      });
    } finally {
      setRowBusy(i, false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr className="text-gray-500 text-xs text-left">
            <th className="px-2 py-1">Time</th>
            <th className="px-2 py-1">Mode</th>
            <th className="px-2 py-1">Symbol</th>
            <th className="px-2 py-1">Side</th>
            <th className="px-2 py-1">Qty</th>
            <th className="px-2 py-1">Price</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1">Exec</th>
            <th className="px-2 py-1 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const idxBusy = !!busy[i];
            const status = (o.status || "").toUpperCase() || "—";
            const statusCls =
              status === "FILLED"
                ? "bg-green-100 text-green-800"
                : status === "ERROR" || status === "REJECTED"
                ? "bg-red-100 text-red-800"
                : status === "PAPER"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800";

            return (
              <tr key={`${i}-${o.orderId ?? ""}`} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1">{fmtTs(o.t, o.ts)}</td>
                <td className="px-2 py-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      o.mode === "live"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {o.mode}
                  </span>
                </td>
                <td className="px-2 py-1">{o.symbol}</td>
                <td className="px-2 py-1 font-semibold">
                  <span className={o.side === "BUY" ? "text-green-700" : "text-red-700"}>
                    {o.side}
                  </span>
                </td>
                <td className="px-2 py-1 tabular-nums truncate">{o.qty?.toFixed(6)}</td>
                <td className="px-2 py-1 tabular-nums truncate">
                  {o.px ? `$${o.px.toFixed(4)}` : "—"}
                </td>
                <td className="px-2 py-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusCls}`}>
                    {status}
                  </span>
                  {o.error && (
                    <span className="ml-1 text-xs text-red-700" title={o.error}>
                      !
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 tabular-nums truncate">
                  {o.executedQty ? o.executedQty.toFixed(6) : "0.000000"}
                </td>
                <td className="px-2 py-1 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => doRefresh(i, o)}
                      disabled={idxBusy}
                      className="px-2 py-0.5 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {idxBusy ? "…" : "Refresh"}
                    </button>
                    {canCancel(o) && (
                      <button
                        onClick={() => doCancel(i, o)}
                        disabled={idxBusy}
                        className="px-2 py-0.5 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        {idxBusy ? "…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
