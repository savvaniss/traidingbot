import Section from "./Section";
import StatBox from "./StatBox";
import { Wallet } from "lucide-react";
import type { OrderPreview, Preference } from "../types";
import { fmtUSD } from "../utilities/format";

export default function OrderPreviewCard(
  { preview, ribbon }: { preview: OrderPreview | null; ribbon: React.ReactNode }
) {
  return (
    <Section title="Order Preview" icon={<Wallet className="w-4 h-4 text-gray-600" />}>
      {ribbon}
      {!preview ? (
        <div className="text-sm text-gray-600">No order suggested yet. When a signal appears, details will show here.</div>
      ) : (
        <div className="grid md:grid-cols-5 gap-3 text-sm items-stretch">
          <div className="md:col-span-2 h-full">
            <StatBox label="Side" value={preview.side} />
            <div className="mt-3"><StatBox label="Symbol" value={preview.symbol} /></div>
          </div>
          <StatBox label="Qty (est.)" value={preview.qty} />
          <StatBox label="Notional (USD)" value={fmtUSD(preview.notionalUsd)} />
          <StatBox label="Est. fees" value={fmtUSD(preview.estFeesUsd)} />
          <div className="md:col-span-5 grid md:grid-cols-3 gap-3 items-stretch">
            <StatBox label="Limit price" value={preview.limitPrice ? fmtUSD(preview.limitPrice) : "(market)"} />
            <StatBox label="Stop" value={preview.stopPrice ? fmtUSD(preview.stopPrice) : "—"} />
            <StatBox label="Take profit" value={preview.takeProfit ? fmtUSD(preview.takeProfit) : "—"} />
          </div>
        </div>
      )}
    </Section>
  );
}
