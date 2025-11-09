import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import type { Signal } from "../types";

export default function useSignal(symbol: string, riskLevel: number, maxExposureUsd: number) {
  const [signal, setSignal] = useState<Signal>({ symbol, side: "FLAT", confidence: 0, reasons: [] });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const params = new URLSearchParams({
          symbol, riskLevel: String(riskLevel), maxExposureUsd: String(maxExposureUsd),
        });
        const r = await fetch(`${BACKEND_URL}/signal?` + params.toString());
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) setSignal(d);
      } catch {
        if (!cancelled) setSignal((s) => ({ ...s, side: "FLAT", confidence: 0 }));
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, riskLevel, maxExposureUsd]);

  return signal;
}
