import Section from "./Section";
import { Settings } from "lucide-react";
import type { Preference } from "../types";

export default function PreferencesPanel(
  { pref, setPref }:
  { pref: Preference; setPref: React.Dispatch<React.SetStateAction<Preference>> }
) {
  return (
    <Section title="Preferences" icon={<Settings className="w-4 h-4 text-gray-600" />}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-700">Risk level</span>
          <span className="tabular-nums text-gray-600">{Math.round(pref.riskLevel * 100)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={pref.riskLevel}
          onChange={(e) => setPref((p) => ({ ...p, riskLevel: parseFloat(e.target.value) }))} className="w-full" />

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700">Max exposure (USD)</span>
          <input type="number" className="w-28 px-2 py-1 border rounded-lg" value={pref.maxExposureUsd}
            onChange={(e) => setPref((p) => ({ ...p, maxExposureUsd: Number(e.target.value || 0) }))} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700">Prefer maker (post-only)</span>
          <input type="checkbox" checked={pref.preferMaker}
            onChange={(e) => setPref((p) => ({ ...p, preferMaker: e.target.checked }))} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700">Slippage budget (bps)</span>
          <input type="number" className="w-20 px-2 py-1 border rounded-lg" value={pref.slippageBps}
            onChange={(e) => setPref((p) => ({ ...p, slippageBps: Number(e.target.value || 0) }))} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700">Time in force</span>
          <select className="px-2 py-1 border rounded-lg" value={pref.timeInForce}
            onChange={(e) => setPref((p) => ({ ...p, timeInForce: e.target.value as Preference["timeInForce"] }))}>
            <option value="GTC">GTC</option><option value="IOC">IOC</option><option value="FOK">FOK</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700">Paper trading</span>
          <input type="checkbox" checked={pref.paperTrading}
            onChange={(e) => setPref((p) => ({ ...p, paperTrading: e.target.checked }))} />
        </label>
      </div>
    </Section>
  );
}
