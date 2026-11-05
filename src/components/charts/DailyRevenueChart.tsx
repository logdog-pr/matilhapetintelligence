"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatDate } from "@/lib/format";
import { useReducedMotion } from "./useReducedMotion";
import { ChartTooltipBox, LegendItem } from "./ChartTooltip";
import { axisMoney, CHART, shortDate } from "./theme";

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  previousRevenue: number | null;
}

/**
 * Faturamento diário (linha 2px, azul) com o período anterior em cinza, mesmo eixo.
 * Hover: crosshair + tooltip com os dois valores.
 */
export function DailyRevenueChart({ data, previousLabel }: { data: DailyPoint[]; previousLabel: string }) {
  const reduced = useReducedMotion();
  const max = Math.max(0, ...data.map((d) => Math.max(d.revenue, d.previousRevenue ?? 0)));
  const hasPrevious = data.some((d) => d.previousRevenue !== null);
  const dense = data.length > 45;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={CHART.series} label="Período selecionado" />
        {hasPrevious && <LegendItem color={CHART.previous} label={previousLabel} />}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: CHART.axis }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
              minTickGap={dense ? 24 : 12}
            />
            <YAxis tickFormatter={axisMoney(max)} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={84} />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as DailyPoint;
                return (
                  <ChartTooltipBox
                    title={formatDate(p.date)}
                    rows={[
                      { label: "Faturamento", value: formatBRL(p.revenue), color: CHART.series },
                      { label: "Pedidos", value: String(p.orders) },
                      ...(p.previousRevenue !== null ? [{ label: previousLabel, value: formatBRL(p.previousRevenue), color: CHART.previous }] : []),
                    ]}
                  />
                );
              }}
            />
            {hasPrevious && (
              <Line
                type="linear"
                dataKey="previousRevenue"
                stroke={CHART.previous}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
                isAnimationActive={!reduced}
                animationDuration={900}
              />
            )}
            <Line
              type="linear"
              dataKey="revenue"
              stroke={CHART.series}
              strokeWidth={2}
              strokeLinecap="round"
              dot={data.length <= 31 ? { r: 2.5, fill: CHART.series, stroke: CHART.surface, strokeWidth: 1.5 } : false}
              activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
              isAnimationActive={!reduced}
              animationDuration={1100}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
