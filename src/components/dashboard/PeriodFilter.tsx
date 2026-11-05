"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { PERIOD_PRESETS, PRESET_LABELS, type PeriodPreset } from "@/lib/periods";
import { cn } from "@/lib/utils";

/** Filtros numa linha acima dos gráficos: período (presets + personalizado) e vendedor. */
export function PeriodFilter({
  preset,
  start,
  end,
  sellers,
  sellerId,
}: {
  preset: PeriodPreset;
  start: string;
  end: string;
  sellers?: { id: string; name: string }[];
  sellerId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState({ de: start, ate: end });

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("pagina");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const quick = PERIOD_PRESETS.filter((p) => p !== "personalizado");

  return (
    <div className={cn("animate-rise mb-6 flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-wrap rounded-lg border border-navy-100 bg-white p-1" role="group" aria-label="Período">
        {quick.map((p) => (
          <button
            key={p}
            onClick={() => go({ p, de: null, ate: null })}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              preset === p ? "bg-navy-900 text-white shadow-sm" : "text-navy-700 hover:bg-navy-50",
            )}
            aria-pressed={preset === p}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      <form
        className={cn(
          "flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 transition-colors",
          preset === "personalizado" ? "border-navy-500" : "border-navy-100",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          go({ p: "personalizado", de: custom.de, ate: custom.ate });
        }}
      >
        <CalendarRange className="h-3.5 w-3.5 text-navy-500" />
        <input
          type="date"
          aria-label="Data inicial"
          value={custom.de}
          onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))}
          className="bg-transparent text-xs text-navy-950 focus:outline-none"
        />
        <span className="text-xs text-muted">até</span>
        <input
          type="date"
          aria-label="Data final"
          value={custom.ate}
          onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))}
          className="bg-transparent text-xs text-navy-950 focus:outline-none"
        />
        <button type="submit" className="rounded-md bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-900 transition-colors hover:bg-navy-100">
          Aplicar
        </button>
      </form>

      {sellers && sellers.length > 0 && (
        <select
          aria-label="Vendedor"
          value={sellerId ?? ""}
          onChange={(e) => go({ vendedor: e.target.value || null })}
          className="h-8 rounded-lg border border-navy-100 bg-white px-2 text-xs font-medium text-navy-900 focus:border-navy-500 focus:outline-none"
        >
          <option value="">Todos os vendedores</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
