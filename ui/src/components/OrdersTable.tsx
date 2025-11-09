import React, { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";
import type { OrderLogEntry, OrderStatusRes } from "../types";

function fmtTimeSecOrMs(o: OrderLogEntry) {
  // prefer ms if present
  const ms = typeof o.ts === "number" ? o.ts : (typeof o.t === "number" ? o.t * 1000 : undefined);
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
}

function StatusBadge({ status }: { status?: OrderLogEntry["status"] }) {
  if (!status) return <span className="text-xs text-gray-500">—</span>;
  const cls =
    status === "FILLED" ? "bg-green-600 text-white" :
    status === "PARTIALLY_FILLED" ? "bg-emerald-600 text-white" :
    status === "NEW" ? "bg-gray-600 text-white" :
    status === "PAPER" ? "bg-blue-600 text-white" :
    ["CANCELED","REJECTED","EXPIRED","ERROR"].includes(status) ? "bg-red-600 text-white" :
    "bg-gray-500 text-white";
  return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>{status}</span>;
}

export default function OrdersTable({ orders }: { orders: OrderLogEntry[] }) {
  // keep a local copy so we can patch a single row after /orders/status refresh
  const [rows, setRows] = useState<OrderLogEntry[]>(orders || []);
  const [loading, setLoading] = useState<Record<number, boolean>>({}); // orderId -> loading

  // sync when parent updates
  useEffect(() => { setRows(orders || []); }, [orders]);

  const onRefresh = async (o: OrderLogEntry) => {
    if (!o.orderId || !o.symbol) return;
    setLoading(p => ({ ...p, [o.orderId!]: true }));
    try {
      const q = new URLSearchParams({ symbol: o.symbol, orderId: String(o.orderId) });
      const res = await fetch(`${BACKEND_URL}/orders/status?${q.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const s = (await res.json()) as OrderStatusRes;

      setRows(prev => prev.map(r =>
        r.orderId === s.orderId
          ? {
              ...r,
              status: (s.status as OrderLogEntry["status"]) ?? r.status,
              executedQty: typeof s.executedQty === "number" ? s.executedQty : r.executedQty,
              cummulativeQuoteQty:
                typeof s.cummulativeQuoteQty === "number" ? s.cummulativeQuoteQty : r.cummulativeQuoteQty,
            }
          : r
      ));
    } catch {
      // no-op; you can toast here if you want
    } finally {
      setLoading(p => ({ ...p, [o.orderId!]: false }));
    }
  };

  const empty = useMemo(() => !rows || rows.length === 0, [rows]);
  if (empty) return <div className="text-sm text-gray-600">No bot orders yet.</div>;

  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr className="text-gray-500 text-xs text-left">
            <th className="px-3 py-1">Time</th>
            <th className="px-3 py-1">Mode</th>
            <th className="px-3 py-1">Symbol</th>
            <th className="px-3 py-1">Side</th>
            <th className="px-3 py-1">Qty</th>
            <th className="px-3 py-1">Price</th>
            <th className="px-3 py-1">Status</th>
            <th className="px-3 py-1">Exec</th>
            <th className="px-3 py-1">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o, i) => (
            <tr key={`${o.symbol}-${o.orderId ?? i}-${o.ts ?? o.t ?? i}`} className="border-t border-gray-200">
              <td className="px-3 py-1">{fmtTimeSecOrMs(o)}</td>
              <td className="px-3 py-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    o.mode === "live" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {o.mode}
                </span>
              </td>
              <td className="px-3 py-1">{o.symbol}</td>
              <td className="px-3 py-1">
                <span className={`font-semibold ${o.side === "BUY" ? "text-green-700" : "text-red-700"}`}>{o.side}</span>
              </td>
              <td className="px-3 py-1 tabular-nums">{o.qty?.toFixed(6)}</td>
              <td className="px-3 py-1 tabular-nums">{o.px ? `$${o.px.toFixed(4)}` : "—"}</td>
              <td className="px-3 py-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} />
                  {o.error ? (
                    <span title={o.error} className="text-xs text-red-600">!</span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-1 tabular-nums">
                {typeof o.executedQty === "number" ? o.executedQty.toFixed(6) : "—"}
              </td>
              <td className="px-3 py-1">
                {o.orderId ? (
                  <button
                    onClick={() => onRefresh(o)}
                    className="px-2 py-0.5 rounded-md border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-60"
                    disabled={!!loading[o.orderId]}
                    title="Refresh status from exchange"
                  >
                    {loading[o.orderId] ? "…" : "Refresh"}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
