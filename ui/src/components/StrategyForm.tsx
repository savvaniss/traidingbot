import Section from "./Section";
import Help from "./Help";
import { Settings } from "lucide-react";
import type { StrategyConfig } from "../types";

export default function StrategyForm(
  { cfg, updateCfg }: { cfg: StrategyConfig; updateCfg: (p: Partial<StrategyConfig>) => void }
) {
  return (
    <Section title="Strategy" icon={<Settings className="w-4 h-4 text-gray-600" />}>
      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            Timeframe <Help tip="Closed-candle resolution for signals." />
          </span>
          <select className="px-2 py-1 border rounded-lg" value={cfg.timeframe}
            onChange={(e) => updateCfg({ timeframe: e.target.value as StrategyConfig["timeframe"] })}>
            <option value="1m">1 minute</option><option value="3m">3 minutes</option><option value="5m">5 minutes</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            Min ATR % <Help tip="If ATR% is below this (and ATR$ is also low), we stay FLAT." />
          </span>
          <input type="number" step={0.005} className="w-24 px-2 py-1 border rounded-lg" value={cfg.minAtrPct}
            onChange={(e) => updateCfg({ minAtrPct: Number(e.target.value || 0) })} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            Min ATR (USD) <Help tip="Absolute ATR floor in dollars." />
          </span>
          <input type="number" step={0.5} className="w-24 px-2 py-1 border rounded-lg" value={cfg.minAtrUsd}
            onChange={(e) => updateCfg({ minAtrUsd: Number(e.target.value || 0) })} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            Confirm streak <Help tip="Consecutive bars required to flip." />
          </span>
          <input type="number" min={1} max={5} className="w-20 px-2 py-1 border rounded-lg" value={cfg.confirmStreak}
            onChange={(e) => updateCfg({ confirmStreak: Number(e.target.value || 1) })} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            Flip cooldown (sec) <Help tip="Minimum seconds between side changes." />
          </span>
          <input type="number" min={0} step={10} className="w-24 px-2 py-1 border rounded-lg" value={cfg.flipCooldownSec}
            onChange={(e) => updateCfg({ flipCooldownSec: Number(e.target.value || 0) })} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            Stop ATR× <Help tip="Stop-loss distance in ATR units." />
          </span>
          <input type="number" step={0.1} className="w-24 px-2 py-1 border rounded-lg" value={cfg.stopAtrMult}
            onChange={(e) => updateCfg({ stopAtrMult: Number(e.target.value || 0) })} />
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="text-gray-700 inline-flex items-center gap-1">
            TP R-multiple <Help tip="TP = entry ± (R × this), where R = |entry − stop|." />
          </span>
          <input type="number" step={0.1} className="w-24 px-2 py-1 border rounded-lg" value={cfg.tpRiskMultiple}
            onChange={(e) => updateCfg({ tpRiskMultiple: Number(e.target.value || 0) })} />
        </label>
      </div>
    </Section>
  );
}
