"use client";

/** Tooltip padrão: valores em tinta de texto; a cor aparece só no marcador da série. */
export function ChartTooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="pointer-events-none min-w-44 rounded-lg border border-navy-100 bg-white px-3 py-2 shadow-lg shadow-navy-950/10">
      <p className="mb-1 text-xs font-medium text-navy-950">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium tabular-nums text-navy-950">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function LegendItem({ color, label, line = true }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      {line ? <span className="h-0.5 w-4 rounded-full" style={{ background: color }} /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
      {label}
    </span>
  );
}
