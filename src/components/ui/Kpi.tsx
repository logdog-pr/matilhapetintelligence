import type { LucideIcon } from "lucide-react";
import { CountUp } from "./CountUp";

/** Card de indicador com número animado e entrada escalonada. */
export function Kpi({
  label,
  value,
  format = "int",
  hint,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: number | null;
  format?: "brl" | "int";
  hint?: string;
  icon?: LucideIcon;
  delay?: number;
}) {
  return (
    <div className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-950">
        <CountUp value={value} format={format} />
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
