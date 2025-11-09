import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import type { OrderLogEntry } from "../types";

export default function useOrdersRecent(limit: number = 50, pollMs: number = 2000) {
  const [orders, setOrders] = useState<OrderLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;

    const fetchIt = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/orders/recent?limit=${limit}`);
        const data = await res.json();
        if (!stop && Array.isArray(data)) setOrders(data);
      } catch {
        if (!stop) setOrders([]);
      } finally {
        if (!stop) setLoading(false);
      }
      timer = window.setTimeout(fetchIt, pollMs);
    };

    fetchIt();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [limit, pollMs]);

  return { orders, loading };
}
