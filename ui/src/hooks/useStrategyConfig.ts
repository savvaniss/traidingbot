import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import type { StrategyConfig } from "../types";

export default function useStrategyConfig() {
  const [cfg, setCfg] = useState<StrategyConfig>({
    timeframe: "1m",
    minAtrPct: 0.02,
    minAtrUsd: 8,
    confirmStreak: 2,
    flipCooldownSec: 120,
    stopAtrMult: 1.5,
    tpRiskMultiple: 2,
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
