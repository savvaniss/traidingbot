export default function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 h-full">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-semibold tabular-nums break-all">{value}</div>
    </div>
  );
}
