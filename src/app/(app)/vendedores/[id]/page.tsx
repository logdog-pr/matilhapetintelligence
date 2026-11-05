import { eq } from "drizzle-orm";
import { Receipt, ShoppingBag, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DailyRevenueChart } from "@/components/charts/DailyRevenueChart";
import { MonthlyRevenueChart } from "@/components/charts/MonthlyCharts";
import { RankingBars } from "@/components/charts/RankingBars";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { GoalEmpty, GoalProgress } from "@/components/goal-progress/GoalProgress";
import { Kpi } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { dashboardOverview, dashboardQuerySchema, dashboardSales, dashboardTopProducts, resolveScope } from "@/lib/dashboard-service";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { formatBRL, formatDate, formatInt } from "@/lib/format";
import { goalsForUser } from "@/lib/goals-service";
import { variation } from "@/lib/queries/dashboard";
import { countNewCustomers } from "@/lib/queries/revenue";

export const metadata: Metadata = { title: "Vendedor" };

export default async function SellerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser("dashboard:view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Vendedor só vê o próprio perfil (validado no servidor)
  if (user.role === "VENDEDOR" && user.sellerId !== id) redirect(user.sellerId ? `/vendedores/${user.sellerId}` : "/");

  const db = getDb();
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id));
  if (!seller) notFound();

  const parsed = dashboardQuerySchema.safeParse(await searchParams);
  const q = parsed.success ? parsed.data : {};
  const scope = resolveScope(user, { ...q, vendedor: id });
  const [overview, sales, top, newCustomers, goals] = await Promise.all([
    dashboardOverview(db, scope),
    dashboardSales(db, scope),
    dashboardTopProducts(db, scope),
    countNewCustomers(db, { start: scope.period.start, end: scope.period.end, sellerId: id }),
    goalsForUser(db, user, { month: scope.period.end.slice(0, 7), sellerId: id }),
  ]);
  const goal = goals.goals.find((g) => g.sellerId === id && g.periodKind === "MENSAL" && g.targetRevenue) ?? null;
  const prevNote = `vs. ${scope.period.previous.label.toLowerCase()}`;
  const ordersHref = `/pedidos?${new URLSearchParams({ p: scope.period.preset, ...(scope.period.preset === "personalizado" ? { de: scope.period.start, ate: scope.period.end } : {}), ...(user.role !== "VENDEDOR" ? { vendedor: id } : {}) }).toString()}`;

  return (
    <>
      <PageHeader
        title={seller.name}
        description={`${seller.region ? `${seller.region} · ` : ""}${scope.period.label}`}
        actions={
          user.role !== "VENDEDOR" ? (
            <Link href="/vendedores" className="text-sm font-medium text-navy-700 hover:underline">
              ← Todos os vendedores
            </Link>
          ) : undefined
        }
      />
      <PeriodFilter preset={scope.period.preset} start={scope.period.start} end={scope.period.end} />

      <div className="space-y-6">
        {goal ? (
          <GoalProgress title="Meta de faturamento" subtitle={`${formatDate(goal.periodStart)} a ${formatDate(goal.periodEnd)}`} progress={goal.revenue} />
        ) : (
          <GoalEmpty title="Sem meta mensal cadastrada" message="Cadastre a meta deste vendedor em Metas." />
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Faturamento" value={overview.revenue} format="brl" icon={TrendingUp} delta={variation(overview.revenue, overview.previous.revenue)} deltaLabel={prevNote} href={ordersHref} />
          <Kpi label="Pedidos" value={overview.orders} icon={ShoppingBag} delay={60} delta={variation(overview.orders, overview.previous.orders)} deltaLabel={prevNote} href={ordersHref} />
          <Kpi label="Ticket médio" value={overview.averageTicket} format="brl" icon={Receipt} delay={120} />
          <Kpi label="Clientes ativos" value={overview.activeCustomers} icon={UserCheck} delay={180} hint={`compraram nos últimos ${overview.activeDays} dias`} />
          <Kpi label="Novos clientes" value={newCustomers} icon={Sparkles} delay={240} hint="primeira compra no período" />
        </div>

        <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-navy-950">Faturamento diário</h2>
          <DailyRevenueChart data={sales.daily} previousLabel={scope.period.previous.label} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-navy-950">Evolução mensal</h2>
            <p className="mb-4 text-xs text-muted">Últimos 12 meses</p>
            <MonthlyRevenueChart data={sales.monthly} />
          </section>
          <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-navy-950">Produtos mais vendidos</h2>
            <p className="mb-4 text-xs text-muted">por valor dos itens</p>
            <RankingBars
              items={top.products.map((p) => ({
                key: String(p.productPedidookId),
                label: p.name,
                sublabel: p.sku ?? undefined,
                value: p.itemsAmount,
                display: formatBRL(p.itemsAmount),
                hint: `${formatInt(p.quantity)} unidades`,
              }))}
            />
          </section>
        </div>
        <p className="text-xs text-muted">Clientes recuperados e clientes sem recompra entram na Fase 4 (inteligência de clientes).</p>
      </div>
    </>
  );
}
