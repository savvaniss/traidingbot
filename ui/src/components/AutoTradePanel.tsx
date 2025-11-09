// src/components/AutoTradePanel.tsx
import { useEffect, useState } from "react";

type AutoState = { enabled: boolean; symbols: string[] };

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
const ALL = ["BTCUSDC","ETHUSDC","BNBUSDC","DOGEUSDC","HBARUSDC","XLMUSDC","SOLUSDC","XRPUSDC"];

export default function AutoTradePanel() {
  const [state, setState] = useState<AutoState>({enabled:false, symbols:[]});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch(`${BACKEND_URL}/autotrade`); 
    setState(await r.json());
  };
  useEffect(() => { load(); }, []);

  const save = async (patch: Partial<AutoState>) => {
    setSaving(true);
    const r = await fetch(`${BACKEND_URL}/autotrade`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(patch)
    });
    setState(await r.json());
    setSaving(false);
  };

  const toggle = () => save({ enabled: !state.enabled });
  const toggleSym = (s: string) => {
    const next = state.symbols.includes(s) ? state.symbols.filter(x=>x!==s) : [...state.symbols, s];
    save({ symbols: next });
  };

  return (
    <div className="bg-white/80 border rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Auto-Trade</div>
        <button className={`px-3 py-1.5 rounded-xl text-sm ${state.enabled ? 'bg-red-600 text-white' : 'bg-black text-white'}`}
                onClick={toggle} disabled={saving}>
          {state.enabled ? 'Stop' : 'Start'}
        </button>
      </div>
      <div className="mt-3 text-xs text-gray-600">
        Select symbols to auto-trade (uses your current strategy config, sizing, SL/TP).
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ALL.map(s => (
          <label key={s} className={`px-3 py-2 border rounded-xl text-sm flex items-center gap-2 ${state.symbols.includes(s) ? 'bg-gray-50' : ''}`}>
            <input type="checkbox" checked={state.symbols.includes(s)} onChange={()=>toggleSym(s)} />
            {s}
          </label>
        ))}
      </div>
      <div className="mt-3 text-xs">
        Status: <span className={`px-2 py-0.5 rounded-full ${state.enabled?'bg-green-100 text-green-800':'bg-gray-100 text-gray-800'}`}>
          {state.enabled ? 'Running' : 'Stopped'}
        </span>
      </div>
    </div>
  );
}
