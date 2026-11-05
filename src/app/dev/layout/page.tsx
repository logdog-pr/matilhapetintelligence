import { notFound } from "next/navigation";
import { DashboardView, type DashboardData } from "@/components/dashboard/DashboardView";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { computeGoalProgress } from "@/lib/metrics/goals";
import { eachDay, lastMonths, resolvePeriod } from "@/lib/periods";

/**
 * Demonstração do layout completo — SOMENTE em desenvolvimento.
 * Todos os valores são EXEMPLOS fixos e determinísticos, não dados da empresa.
 */
export default function LayoutPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const today = "2026-11-18";
  const period = resolvePeriod("mes", today);
  // gerador determinístico (sem Math.random) para o exemplo ficar estável
  const wave = (i: number, base: number) => Math.round(base * (0.75 + 0.35 * Math.sin(i * 1.3) + 0.15 * Math.cos(i * 0.7)));

  const daily = eachDay(period.start, period.end).map((date, i) => {
    const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
    return { date, revenue: weekend ? 0 : wave(i, 6200), orders: weekend ? 0 : wave(i, 14), previousRevenue: weekend ? 0 : wave(i + 3, 5600) };
  });
  const revenue = daily.reduce((s, d) => s + d.revenue, 0);
  const orders = daily.reduce((s, d) => s + d.orders, 0);
  const monthly = lastMonths(today, 12).map((month, i) => {
    const r = i === 11 ? revenue : wave(i, 128000);
    const o = i === 11 ? orders : wave(i + 2, 290);
    return { month, revenue: r, orders: o, averageTicket: Math.round((r / o) * 100) / 100 };
  });

  const data: DashboardData = {
    period,
    overview: {
      revenue,
      orders,
      averageTicket: Math.round((revenue / orders) * 100) / 100,
      grossProfit: Math.round(revenue * 0.27),
      grossMarginPct: 27.4,
      costCoveragePct: 96.2,
      previous: { revenue: Math.round(revenue * 0.91), orders: Math.round(orders * 0.95), averageTicket: Math.round((revenue * 0.91) / (orders * 0.95)) },
      activeCustomers: 318,
      atRiskCustomers: 29,
      inactiveCustomers: 47,
      criticalStock: 12,
    },
    daily,
    monthly,
    sellers: [
      { name: "Vendedor A", region: "Capital", revenue: 41200 },
      { name: "Vendedor B", region: "Interior", revenue: 33800 },
      { name: "Vendedor C", region: "Litoral", revenue: 21900 },
      { name: "Vendedor D", region: "Capital", revenue: 12400 },
    ].map((s, i) => ({ sellerId: `s${i}`, ...s, orders: 40 - i * 7, averageTicket: 380, customers: 30 - i * 4, previousRevenue: s.revenue * 0.9 })),
    products: ["Ração Premium Cães 15kg", "Areia Sanitária 4kg", "Ração Gatos Castrados 10kg", "Petisco Bifinho 500g", "Tapete Higiênico 30un"].map((name, i) => ({
      productId: `p${i}`,
      productPedidookId: i,
      name,
      sku: `SKU-${100 + i}`,
      category: null,
      quantity: 120 - i * 18,
      itemsAmount: 26000 - i * 4300,
    })),
    categories: [
      { category: "Rações", itemsAmount: 61200, quantity: 410 },
      { category: "Higiene", itemsAmount: 23100, quantity: 380 },
      { category: "Petiscos", itemsAmount: 14800, quantity: 520 },
      { category: "Acessórios", itemsAmount: 6900, quantity: 95 },
    ],
    goal: {
      id: "g",
      sellerId: null,
      sellerName: null,
      periodKind: "MENSAL",
      dayMode: "CORRIDOS",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      targetRevenue: 150000,
      targetOrders: 320,
      targetNewCustomers: null,
      revenue: computeGoalProgress({ target: 150000, realized: revenue, periodStart: "2026-11-01", periodEnd: "2026-11-30", today }),
      orders: { realized: orders, target: 320, percent: null },
      newCustomers: { realized: 0, target: null, percent: null },
    },
  };

  return (
    <AppShell role="ADMIN" name="Administrador (exemplo)" freshness="atualizado" lastSync={new Date()}>
      <div className="animate-rise mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning">
        Exemplo visual: valores fictícios para conferência do layout. Esta página não existe em produção.
      </div>
      <PageHeader title="Dashboard geral" description={`${period.label} · faturamento de pedidos por data de emissão`} actions={<Badge tone="success">Exemplo</Badge>} />
      <PeriodFilter preset={period.preset} start={period.start} end={period.end} sellers={[{ id: "s0", name: "Vendedor A" }]} />
      <DashboardView
        data={data}
        ordersHref="#"
        showMargin
        showStock
        showSellers
        goalTitle="Meta de faturamento da empresa"
        goalEmptyMessage=""
      />
    </AppShell>
  );
}
