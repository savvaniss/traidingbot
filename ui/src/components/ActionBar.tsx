import Section from "./Section";
import { Play, Pause } from "lucide-react";

export default function ActionBar(
  { disabled, submitting, onClick, label }:
  { disabled: boolean; submitting: boolean; onClick: () => void; label: string }
) {
  return (
    <Section title="Action" icon={<Play className="w-4 h-4 text-gray-600" />}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white bg-black disabled:opacity-40"
      >
        {submitting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {submitting ? "Submitting…" : label}
      </button>
    </Section>
  );
}
