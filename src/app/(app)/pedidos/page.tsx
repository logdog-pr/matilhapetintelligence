import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { Badge, Card, EmptyState, PageHeader, Table, td, th } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { dashboardOrders, dashboardQuerySchema, resolveScope } from "@/lib/dashboard-service";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { formatBRL, formatDate, formatInt } from "@/lib/format";

export const metadata: Metadata = { title: "Pedidos" };

/** Registros que compõem o faturamento do filtro (spec §7: toda métrica mostra seus registros). */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("dashboard:view");
  const parsed = dashboardQuerySchema.safeParse(await searchParams);
  const q = parsed.success ? parsed.data : {};
  if (user.role === "VENDEDOR" && !user.sellerId) {
    return <EmptyState title="Usuário sem vendedor vinculado" />;
  }
  const scope = resolveScope(user, user.role === "VENDEDOR" ? { ...q, vendedor: undefined } : q);
  const db = getDb();
  const [result, sellerOptions] = await Promise.all([
    dashboardOrders(db, scope, q.pagina ?? 1),
    scope.canCompareSellers
      ? db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.deletedInSource, false)).orderBy(asc(sellers.name))
      : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageHref = (n: number) => {
    const sp = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    sp.set("pagina", String(n));
    return `/pedidos?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Pedidos do faturamento"
        description={`${scope.period.label} · ${formatInt(result.total)} pedidos · ${formatBRL(result.totalAmount)}`}
        actions={
          <Link href={`/?${new URLSearchParams(Object.entries(q).filter(([k, v]) => v !== undefined && k !== "pagina").map(([k, v]) => [k, String(v)])).toString()}`} className="text-sm font-medium text-navy-700 hover:underline">
            ← Voltar ao dashboard
          </Link>
        }
      />
      <PeriodFilter preset={scope.period.preset} start={scope.period.start} end={scope.period.end} sellers={sellerOptions} sellerId={scope.sellerId} />

      {result.total === 0 ? (
        <EmptyState title="Nenhum pedido no período" description="Só aparecem pedidos com status “pedido”, não excluídos no PedidoOK." />
      ) : (
        <Card className="animate-rise">
          <Table>
            <thead>
              <tr>
                <th className={th}>Emissão</th>
                <th className={th}>Nº</th>
                <th className={th}>Cliente</th>
                {scope.canCompareSellers && <th className={th}>Vendedor</th>}
                <th className={th}>Situação</th>
                <th className={`${th} text-right`}>Valor líquido</th>
                {scope.canSeeMargin && <th className={`${th} text-right`}>Custo histórico</th>}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-navy-50/60">
                  <td className={`${td} tabular-nums`}>{formatDate(r.orderDate)}</td>
                  <td className={`${td} tabular-nums text-muted`}>{r.number ?? `#${r.pedidookId}`}</td>
                  <td className={td}>{r.customerName ?? <span className="text-muted">Cliente #{r.customerPedidookId} (não importado)</span>}</td>
                  {scope.canCompareSellers && <td className={td}>{r.sellerName ?? "—"}</td>}
                  <td className={td}>{r.situation ? <Badge>{r.situation}</Badge> : "—"}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{formatBRL(r.netAmount)}</td>
                  {scope.canSeeMargin && <td className={`${td} text-right tabular-nums text-muted`}>{r.costAmount === null ? "—" : formatBRL(r.costAmount)}</td>}
                </tr>
              ))}
            </tbody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-sm">
              <span className="text-muted">
                Página {result.page} de {pages}
              </span>
              <div className="flex gap-2">
                {result.page > 1 && (
                  <Link href={pageHref(result.page - 1)} className="rounded-md border border-navy-100 px-3 py-1 hover:bg-navy-50">
                    Anterior
                  </Link>
                )}
                {result.page < pages && (
                  <Link href={pageHref(result.page + 1)} className="rounded-md border border-navy-100 px-3 py-1 hover:bg-navy-50">
                    Próxima
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
