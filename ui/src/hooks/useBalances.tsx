import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import type { Balance } from "../types";

export default function useBalances() {
  const [balances, setBalances] = useState<Balance[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/balances`);
        const d = await r.json();
        if (!cancelled && Array.isArray(d)) setBalances(d);
      } catch { if (!cancelled) setBalances([]); }
    };
    run();
    const id = setInterval(run, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return balances;
}
