import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import type { Ticker } from "../types";

export default function useTicker(symbol: string) {
  const [tick, setTick] = useState<Ticker>({ symbol, price: 0, ts: 0 });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/tick?symbol=${encodeURIComponent(symbol)}`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) setTick({ symbol, price: Number(d.price || 0), ts: Number(d.ts || 0) });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  return tick;
}
