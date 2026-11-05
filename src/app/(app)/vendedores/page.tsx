import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { Card, EmptyState, PageHeader, Table, td, th } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { dashboardPerformance, dashboardQuerySchema, resolveScope } from "@/lib/dashboard-service";
import { getDb } from "@/lib/db/client";
import { formatBRL, formatInt, formatPercent } from "@/lib/format";
import { goalsForUser } from "@/lib/goals-service";
import { variation } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendedores" };

export default async function SellersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("dashboard:view");
  if (user.role === "VENDEDOR") redirect(user.sellerId ? `/vendedores/${user.sellerId}` : "/");

  const parsed = dashboardQuerySchema.safeParse(await searchParams);
  const q = parsed.success ? { ...parsed.data, vendedor: undefined } : {};
  const scope = resolveScope(user, q);
  const db = getDb();
  const [perf, goals] = await Promise.all([
    dashboardPerformance(db, scope),
    goalsForUser(db, user, { month: scope.period.end.slice(0, 7) }),
  ]);
  const goalBySeller = new Map(goals.goals.filter((g) => g.sellerId && g.periodKind === "MENSAL" && g.targetRevenue).map((g) => [g.sellerId!, g]));
  const total = perf.reduce((s, p) => s + p.revenue, 0);
  const keep = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();

  return (
    <>
      <PageHeader title="Vendedores" description={`Ranking por faturamento · ${scope.period.label}`} />
      <PeriodFilter preset={scope.period.preset} start={scope.period.start} end={scope.period.end} />
      {perf.length === 0 ? (
        <EmptyState title="Nenhum vendedor sincronizado" description="Os vendedores aparecem após a importação do PedidoOK." />
      ) : (
        <Card className="animate-rise">
          <Table>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Vendedor</th>
                <th className={`${th} text-right`}>Faturamento</th>
                <th className={`${th} text-right`}>Variação</th>
                <th className={`${th} text-right`}>Participação</th>
                <th className={`${th} text-right`}>Pedidos</th>
                <th className={`${th} text-right`}>Ticket médio</th>
                <th className={`${th} text-right`}>Clientes</th>
                <th className={`${th} text-right`}>Meta do mês</th>
              </tr>
            </thead>
            <tbody>
              {perf.map((p, i) => {
                const delta = variation(p.revenue, p.previousRevenue);
                const goal = goalBySeller.get(p.sellerId);
                return (
                  <tr key={p.sellerId} className="transition-colors hover:bg-navy-50/60">
                    <td className={`${td} tabular-nums text-muted`}>{i + 1}</td>
                    <td className={td}>
                      <Link href={`/vendedores/${p.sellerId}${keep ? `?${keep}` : ""}`} className="font-medium text-navy-900 hover:underline">
                        {p.name}
                      </Link>
                      {p.region && <span className="ml-1.5 text-xs text-muted">{p.region}</span>}
                    </td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatBRL(p.revenue)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {delta === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-0.5", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted")}>
                          {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                          {delta > 0 ? "+" : ""}
                          {formatPercent(delta)}
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums text-muted`}>{total > 0 ? formatPercent((p.revenue / total) * 100) : "—"}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(p.orders)}</td>
                    <td className={`${td} text-right tabular-nums`}>{p.averageTicket === null ? "—" : formatBRL(p.averageTicket)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(p.customers)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {goal ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-50">
                            <span className="block h-full rounded-full bg-[#2f5fc4]" style={{ width: `${Math.min(100, goal.revenue.percent ?? 0)}%` }} />
                          </span>
                          {formatPercent(goal.revenue.percent)}
                        </span>
                      ) : (
                        <span className="text-muted">sem meta</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="border-t border-navy-100 px-4 py-2.5 text-xs text-muted">
            Variação: {scope.period.previous.label.toLowerCase()}. Atribuição de vendas pelo vendedor oficial do pedido no PedidoOK.
          </p>
        </Card>
      )}
    </>
  );
}
