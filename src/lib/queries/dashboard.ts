/**
 * Consultas do Dashboard (Fase 2). Todas respeitam a definição de faturamento
 * de revenue.ts (status em `revenue.statuses`, não excluído, por data de emissão)
 * e o escopo de vendedor (sellerId) decidido no backend.
 */
import { and, asc, count, desc, eq, isNotNull, sql, sum } from "drizzle-orm";
import { customers, orderItems, orders, products, sellers } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { addDays, eachDay, lastMonths } from "@/lib/periods";
import { getSetting } from "@/lib/settings";
import { getRevenueSummary, revenueWhere, type RevenueFilter } from "./revenue";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Normaliza o retorno de db.execute (node-postgres → {rows}; PGlite → {rows}; postgres-js → array). */
export function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];
}

// ------------------------------------------------------------------ indicadores

export interface Overview {
  revenue: number;
  orders: number;
  averageTicket: number | null;
  /** Lucro bruto estimado = líquido − custo histórico, só de pedidos com custo conhecido. */
  grossProfit: number | null;
  grossMarginPct: number | null;
  /** % do faturamento com custo conhecido (qualidade da estimativa). */
  costCoveragePct: number | null;
  previous: { revenue: number; orders: number; averageTicket: number | null };
  activeCustomers: number;
  inactiveCustomers: number;
  activeDays: number;
  /** null quando o usuário não pode ver estoque (VENDEDOR). */
  criticalStock: number | null;
}

export async function getOverview(
  db: Database,
  f: RevenueFilter & { previous: { start: string; end: string }; includeCompanyOnly: boolean },
): Promise<Overview> {
  const where = await revenueWhere(db, f);
  const [cur, prev, profitRow, activeDays] = await Promise.all([
    getRevenueSummary(db, f),
    getRevenueSummary(db, { ...f, start: f.previous.start, end: f.previous.end }),
    db
      .select({
        knownRevenue: sum(orders.netAmount),
        knownCost: sum(orders.costAmount),
      })
      .from(orders)
      .where(and(where, isNotNull(orders.costAmount))),
    getSetting(db, "customers.activeDays"),
  ]);

  const knownRevenue = num(profitRow[0]?.knownRevenue);
  const knownCost = num(profitRow[0]?.knownCost);
  const hasCost = knownRevenue > 0;
  const grossProfit = hasCost ? round2(knownRevenue - knownCost) : null;

  const customersStats = await getCustomerActivity(db, { end: f.end, sellerId: f.sellerId ?? null, activeDays });

  let criticalStock: number | null = null;
  if (f.includeCompanyOnly) {
    const [row] = await db
      .select({ n: count() })
      .from(products)
      .where(
        and(
          eq(products.deletedInSource, false),
          sql`${products.minimumStock} > 0`,
          sql`coalesce(${products.currentStock}, 0) <= ${products.minimumStock}`,
        ),
      );
    criticalStock = row?.n ?? 0;
  }

  return {
    revenue: cur.revenue,
    orders: cur.orders,
    averageTicket: cur.averageTicket,
    grossProfit,
    grossMarginPct: hasCost && grossProfit !== null ? round2((grossProfit / knownRevenue) * 100) : null,
    costCoveragePct: cur.revenue > 0 ? round2((knownRevenue / cur.revenue) * 100) : null,
    previous: { revenue: prev.revenue, orders: prev.orders, averageTicket: prev.averageTicket },
    activeCustomers: customersStats.active,
    inactiveCustomers: customersStats.inactive,
    activeDays,
    criticalStock,
  };
}

/**
 * Clientes ativos/inativos na data `end` (regra provisória da Fase 2):
 * ativo = última compra nos últimos `activeDays` dias; inativo = já comprou, mas não nesse intervalo.
 * Para VENDEDOR, considera apenas pedidos atribuídos a ele.
 */
export async function getCustomerActivity(db: Database, f: { end: string; sellerId: string | null; activeDays: number }) {
  const statuses = await getSetting(db, "revenue.statuses");
  const statusList = sql.join((statuses.length ? statuses : ["pedido"]).map((s) => sql`${s}`), sql`, `);
  const sellerCond = f.sellerId ? sql`and seller_id = ${f.sellerId}` : sql``;
  const since = addDays(f.end, -(f.activeDays - 1));
  const res = await db.execute(sql`
    select
      count(*) filter (where last_order >= ${since})::int as active,
      count(*) filter (where last_order < ${since})::int as inactive
    from (
      select customer_pedidook_id, max(order_date) as last_order
      from orders
      where deleted_in_source = false and status in (${statusList}) and order_date <= ${f.end} ${sellerCond}
      group by customer_pedidook_id
    ) t`);
  const row = rowsOf<{ active: number; inactive: number }>(res)[0];
  return { active: num(row?.active), inactive: num(row?.inactive) };
}

// ------------------------------------------------------------------ séries

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  /** Faturamento do dia correspondente no período anterior (mesmo índice). */
  previousRevenue: number | null;
}

async function dailyMap(db: Database, f: RevenueFilter) {
  const rows = await db
    .select({ date: orders.orderDate, revenue: sum(orders.netAmount), orders: count() })
    .from(orders)
    .where(await revenueWhere(db, f))
    .groupBy(orders.orderDate);
  return new Map(rows.map((r) => [r.date, { revenue: num(r.revenue), orders: r.orders }]));
}

/** Faturamento diário do período, com todos os dias preenchidos e o período anterior alinhado por posição. */
export async function getDailySeries(db: Database, f: RevenueFilter & { previous: { start: string; end: string } }): Promise<DailyPoint[]> {
  const [cur, prev] = await Promise.all([dailyMap(db, f), dailyMap(db, { ...f, start: f.previous.start, end: f.previous.end })]);
  const prevDays = eachDay(f.previous.start, f.previous.end);
  return eachDay(f.start, f.end).map((date, i) => ({
    date,
    revenue: round2(cur.get(date)?.revenue ?? 0),
    orders: cur.get(date)?.orders ?? 0,
    previousRevenue: i < prevDays.length ? round2(prev.get(prevDays[i])?.revenue ?? 0) : null,
  }));
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  revenue: number;
  orders: number;
  averageTicket: number | null;
}

/** Últimos `months` meses até o mês de `end` (faturamento, pedidos e ticket médio). */
export async function getMonthlySeries(db: Database, f: { end: string; sellerId?: string | null; months?: number }): Promise<MonthlyPoint[]> {
  const months = lastMonths(f.end, f.months ?? 12);
  const start = `${months[0]}-01`;
  const monthExpr = sql<string>`to_char(${orders.orderDate}, 'YYYY-MM')`;
  const rows = await db
    .select({ month: monthExpr, revenue: sum(orders.netAmount), orders: count() })
    .from(orders)
    .where(await revenueWhere(db, { start, end: f.end, sellerId: f.sellerId }))
    .groupBy(monthExpr);
  const map = new Map(rows.map((r) => [r.month, r]));
  return months.map((month) => {
    const r = map.get(month);
    const revenue = round2(num(r?.revenue));
    const n = r?.orders ?? 0;
    return { month, revenue, orders: n, averageTicket: n > 0 ? round2(revenue / n) : null };
  });
}

// ------------------------------------------------------------------ rankings

export interface SellerPerformance {
  sellerId: string;
  name: string;
  region: string | null;
  revenue: number;
  orders: number;
  averageTicket: number | null;
  customers: number;
  previousRevenue: number;
}

export async function getSellerPerformance(
  db: Database,
  f: { start: string; end: string; previous: { start: string; end: string }; sellerId?: string | null },
): Promise<SellerPerformance[]> {
  const agg = async (start: string, end: string) =>
    db
      .select({
        sellerId: orders.sellerId,
        revenue: sum(orders.netAmount),
        orders: count(),
        customers: sql<number>`count(distinct ${orders.customerPedidookId})::int`,
      })
      .from(orders)
      .where(and(await revenueWhere(db, { start, end, sellerId: f.sellerId }), isNotNull(orders.sellerId)))
      .groupBy(orders.sellerId);

  const [cur, prev, list] = await Promise.all([
    agg(f.start, f.end),
    agg(f.previous.start, f.previous.end),
    db
      .select({ id: sellers.id, name: sellers.name, region: sellers.region })
      .from(sellers)
      .where(f.sellerId ? eq(sellers.id, f.sellerId) : eq(sellers.deletedInSource, false)),
  ]);
  const curMap = new Map(cur.map((r) => [r.sellerId, r]));
  const prevMap = new Map(prev.map((r) => [r.sellerId, r]));
  return list
    .map((s) => {
      const c = curMap.get(s.id);
      const revenue = round2(num(c?.revenue));
      const n = c?.orders ?? 0;
      return {
        sellerId: s.id,
        name: s.name,
        region: s.region,
        revenue,
        orders: n,
        averageTicket: n > 0 ? round2(revenue / n) : null,
        customers: num(c?.customers),
        previousRevenue: round2(num(prevMap.get(s.id)?.revenue)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}

export interface ProductRank {
  productId: string | null;
  productPedidookId: number;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  /** Soma do valor dos itens (antes do ajuste do cabeçalho do pedido). */
  itemsAmount: number;
}

/** Produtos mais vendidos por valor dos itens, nos pedidos que contam como faturamento. */
export async function getTopProducts(db: Database, f: RevenueFilter & { limit?: number }): Promise<ProductRank[]> {
  const rows = await db
    .select({
      productId: orderItems.productId,
      productPedidookId: orderItems.productPedidookId,
      name: sql<string>`coalesce(${products.name}, 'Produto #' || ${orderItems.productPedidookId})`,
      sku: products.sku,
      category: products.category,
      quantity: sum(orderItems.quantity),
      itemsAmount: sum(orderItems.totalAmount),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.pedidookId, orderItems.productPedidookId))
    .where(and(await revenueWhere(db, f), eq(orderItems.deletedInSource, false)))
    .groupBy(orderItems.productId, orderItems.productPedidookId, products.name, products.sku, products.category)
    .orderBy(desc(sum(orderItems.totalAmount)))
    .limit(f.limit ?? 10);
  return rows.map((r) => ({ ...r, quantity: num(r.quantity), itemsAmount: round2(num(r.itemsAmount)) }));
}

export interface CategoryRank {
  category: string;
  itemsAmount: number;
  quantity: number;
}

export async function getTopCategories(db: Database, f: RevenueFilter & { limit?: number }): Promise<CategoryRank[]> {
  const cat = sql<string>`coalesce(nullif(trim(${products.category}), ''), 'Sem categoria')`;
  const rows = await db
    .select({ category: cat, itemsAmount: sum(orderItems.totalAmount), quantity: sum(orderItems.quantity) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.pedidookId, orderItems.productPedidookId))
    .where(and(await revenueWhere(db, f), eq(orderItems.deletedInSource, false)))
    .groupBy(cat)
    .orderBy(desc(sum(orderItems.totalAmount)))
    .limit(f.limit ?? 8);
  return rows.map((r) => ({ category: r.category, itemsAmount: round2(num(r.itemsAmount)), quantity: num(r.quantity) }));
}

// ------------------------------------------------------------------ registros que compõem as métricas

export interface OrderRow {
  id: string;
  pedidookId: number;
  number: number | null;
  orderDate: string;
  status: string;
  situation: string | null;
  netAmount: number;
  costAmount: number | null;
  customerName: string | null;
  customerPedidookId: number;
  sellerName: string | null;
}

/** Pedidos que compõem o faturamento do filtro (paginado). */
export async function listRevenueOrders(
  db: Database,
  f: RevenueFilter & { page?: number; pageSize?: number; showCost: boolean },
): Promise<{ rows: OrderRow[]; total: number; totalAmount: number; page: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 10), 200);
  const page = Math.max(1, f.page ?? 1);
  const where = await revenueWhere(db, f);
  const [list, [agg]] = await Promise.all([
    db
      .select({
        id: orders.id,
        pedidookId: orders.pedidookId,
        number: orders.number,
        orderDate: orders.orderDate,
        status: orders.status,
        situation: orders.situation,
        netAmount: orders.netAmount,
        costAmount: orders.costAmount,
        customerName: sql<string | null>`coalesce(${customers.tradeName}, ${customers.corporateName})`,
        customerPedidookId: orders.customerPedidookId,
        sellerName: sellers.name,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(sellers, eq(sellers.id, orders.sellerId))
      .where(where)
      .orderBy(desc(orders.orderDate), desc(orders.number), asc(orders.pedidookId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count(), total: sum(orders.netAmount) }).from(orders).where(where),
  ]);
  return {
    rows: list.map((r) => ({
      ...r,
      netAmount: num(r.netAmount),
      costAmount: f.showCost && r.costAmount !== null ? num(r.costAmount) : null,
    })),
    total: agg?.n ?? 0,
    totalAmount: round2(num(agg?.total)),
    page,
    pageSize,
  };
}

/** Variação percentual entre atual e anterior (null quando não há base). */
export function variation(current: number, previous: number): number | null {
  if (!previous) return null;
  return round2(((current - previous) / previous) * 100);
}

