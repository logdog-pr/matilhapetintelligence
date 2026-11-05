import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";

/**
 * Card de indicador com número animado, variação vs. período anterior
 * (ícone + texto, nunca só cor) e link para os registros que o compõem.
 */
export function Kpi({
  label,
  value,
  format = "int",
  hint,
  icon: Icon,
  delay = 0,
  delta,
  deltaLabel = "vs. período anterior",
  href,
  invertDelta = false,
  text,
}: {
  label: string;
  value: number | null;
  format?: "brl" | "int" | "pct";
  hint?: string;
  icon?: LucideIcon;
  delay?: number;
  delta?: number | null;
  deltaLabel?: string;
  href?: string;
  /** Quando subir é ruim (ex.: clientes inativos). */
  invertDelta?: boolean;
  /** Texto exibido no lugar do número (ex.: uma data). */
  text?: string;
}) {
  const up = delta !== null && delta !== undefined && delta > 0;
  const down = delta !== null && delta !== undefined && delta < 0;
  const good = invertDelta ? down : up;
  const bad = invertDelta ? up : down;
  const DeltaIcon = up ? ArrowUpRight : down ? ArrowDownRight : ArrowRight;

  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy-50 text-navy-700 transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-950">
        {text !== undefined ? text : format === "pct" ? (value === null ? "—" : formatPercent(value)) : <CountUp value={value} format={format} />}
      </p>
      {delta !== undefined && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          {delta === null ? (
            <span>sem base de comparação</span>
          ) : (
            <>
              <span className={cn("inline-flex items-center gap-0.5 font-medium", good && "text-success", bad && "text-danger")}>
                <DeltaIcon className="h-3 w-3" aria-hidden />
                {delta > 0 ? "+" : ""}
                {formatPercent(delta)}
              </span>
              <span>{deltaLabel}</span>
            </>
          )}
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      {href && <p className="mt-2 text-[11px] font-medium text-navy-700 opacity-70 transition-opacity group-hover:opacity-100">Ver registros →</p>}
    </>
  );

  const cls = "group lift animate-rise block rounded-xl border border-navy-100 bg-white p-5";
  return href ? (
    <Link href={href} className={cls} style={{ animationDelay: `${delay}ms` }}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={{ animationDelay: `${delay}ms` }}>
      {body}
    </div>
  );
}
