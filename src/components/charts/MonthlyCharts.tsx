"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/format";
import { useReducedMotion } from "./useReducedMotion";
import { ChartTooltipBox } from "./ChartTooltip";
import { axisMoney, CHART, shortMonth } from "./theme";

export interface MonthlyPoint {
  month: string;
  revenue: number;
  orders: number;
  averageTicket: number | null;
}

/** Faturamento mensal: colunas finas (≤ 24px), ponta superior arredondada, valor no tooltip. */
export function MonthlyRevenueChart({ data }: { data: MonthlyPoint[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(0, ...data.map((d) => d.revenue));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={4}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="month" tickFormatter={shortMonth} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis tickFormatter={axisMoney(max)} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={84} />
          <Tooltip
            cursor={{ fill: "#f4f7fb" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as MonthlyPoint;
              return (
                <ChartTooltipBox
                  title={shortMonth(p.month)}
                  rows={[
                    { label: "Faturamento", value: formatBRL(p.revenue), color: CHART.series },
                    { label: "Pedidos", value: String(p.orders) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="revenue" fill={CHART.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Evolução do ticket médio: gráfico próprio (nunca eixo duplo com o faturamento). */
export function TicketTrendChart({ data }: { data: MonthlyPoint[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(0, ...data.map((d) => d.averageTicket ?? 0));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="month" tickFormatter={shortMonth} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis tickFormatter={axisMoney(max)} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={84} />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as MonthlyPoint;
              return (
                <ChartTooltipBox
                  title={shortMonth(p.month)}
                  rows={[
                    { label: "Ticket médio", value: p.averageTicket === null ? "sem pedidos" : formatBRL(p.averageTicket), color: CHART.series },
                    { label: "Pedidos", value: String(p.orders) },
                  ]}
                />
              );
            }}
          />
          <Line
            type="linear"
            dataKey="averageTicket"
            stroke={CHART.series}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3, fill: CHART.series, stroke: CHART.surface, strokeWidth: 1.5 }}
            activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
