/**
 * Faturamento de pedidos (NÃO é recebimento nem lucro).
 * Definição: Σ net_amount dos pedidos com status em `revenue.statuses`
 * (padrão: "pedido"), não excluídos no PedidoOK, com data de emissão no período.
 */
import { and, count, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { orders } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { getSetting } from "@/lib/settings";

export interface RevenueFilter {
  start: string;
  end: string;
  sellerId?: string | null;
}

export interface RevenueSummary {
  revenue: number;
  orders: number;
  averageTicket: number | null;
}

export async function revenueWhere(db: Database, f: RevenueFilter) {
  const statuses = await getSetting(db, "revenue.statuses");
  return and(
    eq(orders.deletedInSource, false),
    inArray(orders.status, statuses.length ? statuses : ["pedido"]),
    gte(orders.orderDate, f.start),
    lte(orders.orderDate, f.end),
    f.sellerId ? eq(orders.sellerId, f.sellerId) : undefined,
  );
}

export async function getRevenueSummary(db: Database, f: RevenueFilter): Promise<RevenueSummary> {
  const [row] = await db
    .select({ revenue: sum(orders.netAmount), orders: count() })
    .from(orders)
    .where(await revenueWhere(db, f));
  const revenue = Number(row?.revenue ?? 0);
  const n = row?.orders ?? 0;
  return { revenue, orders: n, averageTicket: n > 0 ? Math.round((revenue / n) * 100) / 100 : null };
}

/** Faturamento agrupado por vendedor no período. */
export async function getRevenueBySeller(db: Database, f: RevenueFilter): Promise<Map<string, RevenueSummary>> {
  const rows = await db
    .select({ sellerId: orders.sellerId, revenue: sum(orders.netAmount), orders: count() })
    .from(orders)
    .where(await revenueWhere(db, f))
    .groupBy(orders.sellerId);
  const map = new Map<string, RevenueSummary>();
  for (const r of rows) {
    if (!r.sellerId) continue;
    const revenue = Number(r.revenue ?? 0);
    map.set(r.sellerId, { revenue, orders: r.orders, averageTicket: r.orders ? Math.round((revenue / r.orders) * 100) / 100 : null });
  }
  return map;
}

/**
 * Clientes novos: primeira compra (pedido de faturamento) registrada dentro do período.
 * Limitação: depende do histórico que o PedidoOK disponibilizou na importação.
 */
export async function countNewCustomers(db: Database, f: RevenueFilter): Promise<number> {
  const statuses = await getSetting(db, "revenue.statuses");
  const statusList = sql.join(
    (statuses.length ? statuses : ["pedido"]).map((s) => sql`${s}`),
    sql`, `,
  );
  const sellerCond = f.sellerId ? sql`and first.seller_id = ${f.sellerId}` : sql``;
  const result = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from (
      select distinct on (customer_pedidook_id) customer_pedidook_id, order_date, seller_id
      from orders
      where deleted_in_source = false and status in (${statusList})
      order by customer_pedidook_id, order_date asc
    ) first
    where first.order_date between ${f.start} and ${f.end} ${sellerCond}`);
  const rows = (Array.isArray(result) ? result : (result as { rows: { n: number }[] }).rows) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}
