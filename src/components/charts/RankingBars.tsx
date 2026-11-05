"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CHART } from "./theme";

export interface RankingItem {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  display: string;
  hint?: string;
}

/**
 * Ranking em barras horizontais (HTML): uma cor só (sem rampa de valor em
 * categorias nominais), barras finas com ponta arredondada, valor na ponta,
 * hover destaca a linha. Animam crescendo da esquerda.
 */
export function RankingBars({ items, emptyText = "Sem dados no período." }: { items: RankingItem[]; emptyText?: string }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!items.length || max === 0) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>;

  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={it.key} className="group rounded-md px-1 py-0.5 transition-colors hover:bg-navy-50/70" title={it.hint}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-navy-950">
              <span className="mr-1.5 tabular-nums text-muted">{i + 1}.</span>
              {it.label}
              {it.sublabel && <span className="ml-1.5 text-xs text-muted">{it.sublabel}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-navy-950">{it.display}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-navy-50">
            <div
              className={cn("h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none")}
              style={{ width: grown ? `${Math.max(1.5, (it.value / max) * 100)}%` : "0%", background: CHART.series, transitionDelay: `${i * 40}ms` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
