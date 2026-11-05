import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GoalEmpty, GoalProgress } from "@/components/goal-progress/GoalProgress";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { formatDate, formatInt, monthLabel, todayInSaoPaulo } from "@/lib/format";
import { goalsForUser } from "@/lib/goals-service";
import type { GoalWithProgress } from "@/lib/queries/goals";
import { DeleteGoalButton, GoalForm } from "./GoalForm";

export const metadata: Metadata = { title: "Metas" };

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requirePageUser("goals:view");
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : todayInSaoPaulo().slice(0, 7);
  const db = getDb();

  if (user.role === "VENDEDOR" && !user.sellerId) {
    return (
      <>
        <PageHeader title="Metas" />
        <GoalEmpty title="Usuário sem vendedor vinculado" message="Peça ao administrador para vincular seu usuário ao seu cadastro de vendedor." />
      </>
    );
  }

  const { goals, period } = await goalsForUser(db, user, { month, sellerId: user.role === "VENDEDOR" ? user.sellerId : null });
  const manage = can(user, "goals:manage");
  const sellerOptions = manage
    ? await db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.deletedInSource, false)).orderBy(asc(sellers.name))
    : [];

  const companyGoals = goals.filter((g) => g.sellerId === null);
  // Ranking de vendedores pelo % da meta de faturamento
  const sellerGoals = goals
    .filter((g) => g.sellerId !== null)
    .sort((a, b) => (b.revenue.percent ?? -1) - (a.revenue.percent ?? -1));

  return (
    <>
      <PageHeader
        title="Metas"
        description="Faturamento de pedidos versus meta. Projeções são estimativas, não faturamento confirmado."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white p-1">
            <Link href={`/metas?mes=${shiftMonth(month, -1)}`} className="grid h-7 w-7 place-items-center rounded-md hover:bg-navy-50" aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-36 text-center text-sm font-medium text-navy-950">{monthLabel(`${month}-01`)}</span>
            <Link href={`/metas?mes=${shiftMonth(month, 1)}`} className="grid h-7 w-7 place-items-center rounded-md hover:bg-navy-50" aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="space-y-8">
        {manage && <GoalForm sellers={sellerOptions} defaultMonth={month} />}

        {user.role !== "VENDEDOR" && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-navy-950">Empresa</h2>
            {companyGoals.length === 0 ? (
              <EmptyState title="Sem meta da empresa neste período" description={`${formatDate(period.start)} a ${formatDate(period.end)}`} />
            ) : (
              <div className="space-y-4">
                {companyGoals.map((g) => (
                  <GoalCard key={g.id} goal={g} title="Meta da empresa" manage={manage} />
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-navy-950">{user.role === "VENDEDOR" ? "Minhas metas" : "Ranking de vendedores"}</h2>
          {sellerGoals.length === 0 ? (
            <EmptyState title="Nenhuma meta de vendedor neste período" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {sellerGoals.map((g, i) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  title={user.role === "VENDEDOR" ? "Minha meta" : `${i + 1}º · ${g.sellerName ?? "Vendedor"}`}
                  manage={manage}
                  size="md"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function GoalCard({ goal: g, title, manage, size = "lg" }: { goal: GoalWithProgress; title: string; manage: boolean; size?: "lg" | "md" }) {
  const kind = g.periodKind === "MENSAL" ? "Mensal" : g.periodKind === "SEMANAL" ? "Semanal" : "Personalizada";
  const extras = [
    { label: "Pedidos", value: g.orders.target ? `${formatInt(g.orders.realized)} de ${formatInt(g.orders.target)}` : formatInt(g.orders.realized) },
    ...(g.newCustomers.target
      ? [{ label: "Novos clientes", value: `${formatInt(g.newCustomers.realized)} de ${formatInt(g.newCustomers.target)}` }]
      : []),
  ];
  return (
    <div className="relative">
      {g.targetRevenue ? (
        <GoalProgress title={title} subtitle={`${kind} · ${formatDate(g.periodStart)} a ${formatDate(g.periodEnd)}`} progress={g.revenue} extras={extras} size={size} />
      ) : (
        <GoalEmpty title={title} message={`Meta sem alvo de faturamento. ${extras.map((e) => `${e.label}: ${e.value}`).join(" · ")}`} period={{ start: g.periodStart, end: g.periodEnd }} />
      )}
      {manage && (
        <div className="mt-1 flex justify-end">
          <DeleteGoalButton id={g.id} />
        </div>
      )}
    </div>
  );
}
