"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { ChartTooltipBox, LegendItem } from "./ChartTooltip";
import { CHART, shortDate } from "./theme";
import { useReducedMotion } from "./useReducedMotion";

/** Unidades vendidas por dia (colunas finas) com a demanda média como linha de referência. */
export function DailyQuantityChart({ data, average, unit }: { data: { date: string; quantity: number }[]; average: number; unit?: string | null }) {
  const reduced = useReducedMotion();
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={CHART.series} label={`Vendido por dia${unit ? ` (${unit})` : ""}`} line={false} />
        <LegendItem color={CHART.axis} label={`Média diária: ${fmt(average)}`} />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "#f4f7fb" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { date: string; quantity: number };
                return <ChartTooltipBox title={formatDate(p.date)} rows={[{ label: "Vendido", value: fmt(p.quantity), color: CHART.series }]} />;
              }}
            />
            {average > 0 && <ReferenceLine y={average} stroke={CHART.axis} strokeWidth={1} />}
            <Bar dataKey="quantity" fill={CHART.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
