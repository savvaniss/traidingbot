import React from "react";
import type { OrderLogEntry } from "../types";

function fmtTs(t: number) {
  try {
    return new Date(t * 1000).toLocaleString();
  } catch {
    return String(t);
  }
}

export default function OrdersTable({ orders }: { orders: OrderLogEntry[] }) {
  if (!orders || orders.length === 0) {
    return <div className="text-sm text-gray-600">No bot orders yet.</div>;
  }

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
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={i} className="border-t border-gray-200">
              <td className="px-3 py-1">{fmtTs(o.t)}</td>
              <td className="px-3 py-1">
                <span className={`px-2 py-0.5 rounded-full text-xs ${o.mode === "live" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                  {o.mode}
                </span>
              </td>
              <td className="px-3 py-1">{o.symbol}</td>
              <td className="px-3 py-1">
                <span className={`font-semibold ${o.side === "BUY" ? "text-green-700" : "text-red-700"}`}>{o.side}</span>
              </td>
              <td className="px-3 py-1 tabular-nums">{o.qty?.toFixed(6)}</td>
              <td className="px-3 py-1 tabular-nums">{o.px ? `$${o.px.toFixed(4)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
