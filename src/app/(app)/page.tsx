import type { Metadata } from "next";
import Link from "next/link";
import { GoalEmpty, GoalProgress } from "@/components/goal-progress/GoalProgress";
import { Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { Kpi } from "@/components/ui/Kpi";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDate, formatInt, monthBounds, monthLabel, todayInSaoPaulo } from "@/lib/format";
import { goalsForUser } from "@/lib/goals-service";
import { getRevenueSummary } from "@/lib/queries/revenue";
import { getSyncHealth } from "@/lib/queries/sync-health";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePageUser("dashboard:view");
  const db = getDb();
  const today = todayInSaoPaulo();
  const month = monthBounds(today);
  const company = can(user, "dashboard:company");

  if (!company && !user.sellerId) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <GoalEmpty title="Usuário sem vendedor vinculado" message="Peça ao administrador para vincular seu usuário ao seu cadastro de vendedor no PedidoOK." />
      </>
    );
  }

  const sellerId = company ? null : user.sellerId;
  const [health, summary, { goals }] = await Promise.all([
    getSyncHealth(db),
    getRevenueSummary(db, { start: month.start, end: month.end, sellerId }),
    goalsForUser(db, user, { sellerId }),
  ]);
  const ordersHealth = health.resources.find((r) => r.resource === "pedidos");
  const hasData = !!ordersHealth?.lastSuccessfulSync;
  const mainGoal = goals.find((g) => (company ? g.sellerId === null : g.sellerId === user.sellerId) && g.periodKind === "MENSAL" && g.targetRevenue);

  return (
    <>
      <PageHeader
        title={company ? "Dashboard geral" : "Meu desempenho"}
        description={`${monthLabel(today)} · faturamento de pedidos por data de emissão`}
        actions={
          health.overall !== "atualizado" ? (
            <Badge tone={health.overall === "indisponivel" ? "neutral" : "warning"}>
              {health.overall === "indisponivel" ? "Aguardando primeira sincronização" : "Dados podem não refletir o momento atual"}
            </Badge>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {!hasData ? (
          <GoalEmpty
            title="Dados indisponíveis"
            message={
              can(user, "integration:manage")
                ? "Nenhum pedido foi importado do PedidoOK ainda. Rode a importação histórica em Integração PedidoOK."
                : "Nenhum pedido foi importado do PedidoOK ainda. Assim que o administrador concluir a importação, os números aparecem aqui."
            }
          />
        ) : mainGoal ? (
          <GoalProgress
            title={company ? "Meta de faturamento da empresa" : "Minha meta de faturamento"}
            subtitle={`${formatDate(mainGoal.periodStart)} a ${formatDate(mainGoal.periodEnd)}`}
            progress={mainGoal.revenue}
            extras={[
              { label: "Pedidos", value: mainGoal.orders.target ? `${formatInt(mainGoal.orders.realized)} de ${formatInt(mainGoal.orders.target)}` : formatInt(mainGoal.orders.realized) },
            ]}
          />
        ) : (
          <GoalEmpty
            title="Nenhuma meta mensal cadastrada"
            message={can(user, "goals:manage") ? "Cadastre a meta do mês em Metas para acompanhar o progresso aqui." : "O administrador ainda não cadastrou a meta deste mês."}
            period={month}
          />
        )}

        {hasData && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="Faturamento do mês" value={summary.revenue} format="brl" icon={TrendingUp} hint="pedidos com status “pedido”, não excluídos" />
            <Kpi label="Pedidos realizados" value={summary.orders} icon={ShoppingBag} delay={80} />
            <Kpi label="Ticket médio" value={summary.averageTicket} format="brl" icon={Receipt} delay={160} hint="faturamento ÷ pedidos" />
          </div>
        )}

        <p className="text-xs text-muted">
          Gráficos, comparativos e demais indicadores chegam na Fase 2.{" "}
          {can(user, "goals:view_all") && (
            <Link href="/metas" className="text-navy-700 underline underline-offset-2">
              Ver todas as metas
            </Link>
          )}
        </p>
      </div>
    </>
  );
}
