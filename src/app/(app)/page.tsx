import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { GoalEmpty } from "@/components/goal-progress/GoalProgress";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import {
  dashboardOverview,
  dashboardPerformance,
  dashboardQuerySchema,
  dashboardSales,
  dashboardTopProducts,
  resolveScope,
} from "@/lib/dashboard-service";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { goalsForUser } from "@/lib/goals-service";
import { getSyncHealth } from "@/lib/queries/sync-health";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("dashboard:view");
  const parsed = dashboardQuerySchema.safeParse(await searchParams);
  const q = parsed.success ? parsed.data : {};
  const company = can(user, "dashboard:company");

  if (!company && !user.sellerId) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <GoalEmpty title="Usuário sem vendedor vinculado" message="Peça ao administrador para vincular seu usuário ao seu cadastro de vendedor no PedidoOK." />
      </>
    );
  }

  const db = getDb();
  // Vendedor pedindo outro vendedor na URL: ignora e mostra os próprios dados.
  const scope = resolveScope(user, user.role === "VENDEDOR" ? { ...q, vendedor: undefined } : q);
  const [health, overview, sales, sellerPerf, top, goalData, sellerOptions] = await Promise.all([
    getSyncHealth(db),
    dashboardOverview(db, scope),
    dashboardSales(db, scope),
    dashboardPerformance(db, scope),
    dashboardTopProducts(db, scope),
    goalsForUser(db, user, { month: scope.period.end.slice(0, 7), sellerId: scope.sellerId }),
    scope.canCompareSellers
      ? db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.deletedInSource, false)).orderBy(asc(sellers.name))
      : Promise.resolve([]),
  ]);

  const goal =
    goalData.goals.find((g) => (scope.sellerId ? g.sellerId === scope.sellerId : g.sellerId === null) && g.periodKind === "MENSAL" && g.targetRevenue) ?? null;
  const hasData = !!health.resources.find((r) => r.resource === "pedidos")?.lastSuccessfulSync;
  const selectedSeller = sellerOptions.find((s) => s.id === scope.sellerId)?.name;

  const qs = new URLSearchParams();
  qs.set("p", scope.period.preset);
  if (scope.period.preset === "personalizado") {
    qs.set("de", scope.period.start);
    qs.set("ate", scope.period.end);
  }
  if (scope.sellerId && user.role !== "VENDEDOR") qs.set("vendedor", scope.sellerId);

  return (
    <>
      <PageHeader
        title={!company ? "Meu desempenho" : selectedSeller ? `Dashboard · ${selectedSeller}` : "Dashboard geral"}
        description={`${scope.period.label} · faturamento de pedidos por data de emissão`}
        actions={
          health.overall !== "atualizado" ? (
            <Badge tone={health.overall === "indisponivel" ? "neutral" : "warning"}>
              {health.overall === "indisponivel" ? "Aguardando primeira sincronização" : "Dados podem não refletir o momento atual"}
            </Badge>
          ) : undefined
        }
      />

      <PeriodFilter preset={scope.period.preset} start={scope.period.start} end={scope.period.end} sellers={sellerOptions} sellerId={scope.sellerId} />

      {!hasData ? (
        <GoalEmpty
          title="Dados indisponíveis"
          message={
            can(user, "integration:manage")
              ? "Nenhum pedido foi importado do PedidoOK ainda. Rode a importação histórica em Integração PedidoOK."
              : "Nenhum pedido foi importado do PedidoOK ainda. Assim que o administrador concluir a importação, os números aparecem aqui."
          }
        />
      ) : (
        <DashboardView
          data={{ period: scope.period, overview, daily: sales.daily, monthly: sales.monthly, sellers: sellerPerf, products: top.products, categories: top.categories, goal }}
          ordersHref={`/pedidos?${qs.toString()}`}
          showMargin={scope.canSeeMargin}
          showStock={scope.canSeeStock}
          showSellers={scope.canCompareSellers && !scope.sellerId}
          goalTitle={!company ? "Minha meta de faturamento" : selectedSeller ? `Meta de ${selectedSeller}` : "Meta de faturamento da empresa"}
          goalEmptyMessage={can(user, "goals:manage") ? "Cadastre a meta do mês em Metas para acompanhar o progresso aqui." : "O administrador ainda não cadastrou a meta deste mês."}
        />
      )}
    </>
  );
}
