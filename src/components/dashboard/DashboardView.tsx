import { AlertTriangle, PackageX, Percent, Receipt, ShoppingBag, TrendingUp, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { DailyRevenueChart } from "@/components/charts/DailyRevenueChart";
import { MonthlyRevenueChart, TicketTrendChart } from "@/components/charts/MonthlyCharts";
import { RankingBars } from "@/components/charts/RankingBars";
import { GoalEmpty, GoalProgress } from "@/components/goal-progress/GoalProgress";
import { Kpi } from "@/components/ui/Kpi";
import { formatBRL, formatDate, formatInt, formatPercent } from "@/lib/format";
import type { Period } from "@/lib/periods";
import type { CategoryRank, DailyPoint, MonthlyPoint, Overview, ProductRank, SellerPerformance } from "@/lib/queries/dashboard";
import { variation } from "@/lib/queries/dashboard";
import type { GoalWithProgress } from "@/lib/queries/goals";

export interface DashboardData {
  period: Period;
  overview: Overview;
  daily: DailyPoint[];
  monthly: MonthlyPoint[];
  sellers: SellerPerformance[];
  products: ProductRank[];
  categories: CategoryRank[];
  goal: GoalWithProgress | null;
}

function Panel({ title, subtitle, children, delay = 0, action }: { title: string; subtitle?: string; children: React.ReactNode; delay?: number; action?: React.ReactNode }) {
  return (
    <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5" style={{ animationDelay: `${delay}ms` }}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DashboardView({
  data,
  ordersHref,
  showMargin,
  showStock,
  showSellers,
  goalTitle,
  goalEmptyMessage,
}: {
  data: DashboardData;
  ordersHref: string;
  showMargin: boolean;
  showStock: boolean;
  showSellers: boolean;
  goalTitle: string;
  goalEmptyMessage: string;
}) {
  const { period, overview: o } = data;
  const prevNote = `vs. ${data.period.previous.label.toLowerCase()}`;

  return (
    <div className="space-y-6">
      {/* Meta */}
      {data.goal && data.goal.targetRevenue ? (
        <GoalProgress
          title={goalTitle}
          subtitle={`${formatDate(data.goal.periodStart)} a ${formatDate(data.goal.periodEnd)}`}
          progress={data.goal.revenue}
          extras={[
            {
              label: "Pedidos",
              value: data.goal.orders.target ? `${formatInt(data.goal.orders.realized)} de ${formatInt(data.goal.orders.target)}` : formatInt(data.goal.orders.realized),
            },
          ]}
        />
      ) : (
        <GoalEmpty title="Nenhuma meta mensal cadastrada" message={goalEmptyMessage} />
      )}

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Faturamento" value={o.revenue} format="brl" icon={TrendingUp} delta={variation(o.revenue, o.previous.revenue)} deltaLabel={prevNote} href={ordersHref} />
        <Kpi label="Pedidos realizados" value={o.orders} icon={ShoppingBag} delay={60} delta={variation(o.orders, o.previous.orders)} deltaLabel={prevNote} href={ordersHref} />
        <Kpi
          label="Ticket médio"
          value={o.averageTicket}
          format="brl"
          icon={Receipt}
          delay={120}
          delta={o.averageTicket !== null && o.previous.averageTicket ? variation(o.averageTicket, o.previous.averageTicket) : null}
          deltaLabel={prevNote}
          hint="faturamento ÷ pedidos"
        />
        {showMargin ? (
          <Kpi
            label="Lucro bruto estimado"
            value={o.grossProfit}
            format="brl"
            icon={Percent}
            delay={180}
            hint={
              o.grossMarginPct === null
                ? "sem custo histórico nos pedidos"
                : `margem bruta ${formatPercent(o.grossMarginPct)} · custo conhecido em ${formatPercent(o.costCoveragePct)} do faturamento`
            }
          />
        ) : (
          <Kpi label="Clientes atendidos" value={o.activeCustomers} icon={UserCheck} delay={180} hint={`compraram nos últimos ${o.activeDays} dias`} />
        )}
        {showMargin && (
          <Kpi label="Clientes ativos" value={o.activeCustomers} icon={UserCheck} delay={240} hint={`compraram nos últimos ${o.activeDays} dias até ${formatDate(period.end)}`} />
        )}
        <Kpi label="Clientes inativos" value={o.inactiveCustomers} icon={UserX} delay={300} hint={`sem compra há mais de ${o.activeDays} dias (regra provisória)`} />
        {showStock && (
          <Kpi label="Estoque crítico" value={o.criticalStock} icon={o.criticalStock ? AlertTriangle : PackageX} delay={360} hint="produtos no estoque mínimo ou abaixo (estoque atual)" href="/estoque?relatorio=comprar" />
        )}
      </div>

      {/* Faturamento diário com comparação */}
      <Panel
        title="Faturamento diário"
        subtitle={`${period.label} · comparado com ${period.previous.label.toLowerCase()}`}
        delay={120}
        action={
          <Link href={ordersHref} className="text-xs font-medium text-navy-700 hover:underline">
            Ver pedidos
          </Link>
        }
      >
        <DailyRevenueChart data={data.daily} previousLabel={period.previous.label} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Faturamento mensal" subtitle="Últimos 12 meses" delay={160}>
          <MonthlyRevenueChart data={data.monthly} />
        </Panel>
        <Panel title="Evolução do ticket médio" subtitle="Últimos 12 meses" delay={200}>
          <TicketTrendChart data={data.monthly} />
        </Panel>
      </div>

      <div className={showSellers ? "grid gap-6 lg:grid-cols-3" : "grid gap-6 lg:grid-cols-2"}>
        {showSellers && (
          <Panel
            title="Desempenho por vendedor"
            subtitle={period.label}
            delay={220}
            action={
              <Link href="/vendedores" className="text-xs font-medium text-navy-700 hover:underline">
                Detalhes
              </Link>
            }
          >
            <RankingBars
              items={data.sellers.map((s) => ({
                key: s.sellerId,
                label: s.name,
                sublabel: s.region ?? undefined,
                value: s.revenue,
                display: formatBRL(s.revenue),
                hint: `${s.orders} pedidos · ${s.customers} clientes`,
              }))}
            />
          </Panel>
        )}
        <Panel title="Produtos mais vendidos" subtitle="por valor dos itens (antes de descontos do cabeçalho)" delay={260}>
          <RankingBars
            items={data.products.map((p) => ({
              key: String(p.productPedidookId),
              label: p.name,
              sublabel: p.sku ?? undefined,
              value: p.itemsAmount,
              display: formatBRL(p.itemsAmount),
              hint: `${formatInt(p.quantity)} unidades vendidas`,
            }))}
          />
        </Panel>
        <Panel title="Categorias mais vendidas" subtitle="por valor dos itens" delay={300}>
          <RankingBars
            items={data.categories.map((c) => ({
              key: c.category,
              label: c.category,
              value: c.itemsAmount,
              display: formatBRL(c.itemsAmount),
              hint: `${formatInt(c.quantity)} unidades`,
            }))}
          />
        </Panel>
      </div>

      <p className="text-xs text-muted">
        Faturamento = pedidos com status “pedido”, não excluídos no PedidoOK, por data de emissão. Não é recebimento nem lucro.
      </p>
    </div>
  );
}
