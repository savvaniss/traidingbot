import Section from "./Section";
import { Wallet } from "lucide-react";
import type { Balance } from "../types";

export default function BalancesTable({ balances }: { balances: Balance[] }) {
  return (
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
  );
}
