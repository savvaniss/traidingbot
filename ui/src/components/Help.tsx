import { Info } from "lucide-react";

export default function Help({ tip }: { tip: string }) {
  return (
    <span title={tip} aria-label={tip}
      className="inline-flex items-center cursor-help text-gray-400 hover:text-gray-600">
      <Info className="w-3.5 h-3.5" />
    </span>
  );
}
