/**
 * Inteligência de clientes (Fase 4, spec §10).
 *
 * Escopo:
 *  - Empresa (ADMIN/GESTOR): todos os pedidos de faturamento do cliente.
 *  - Vendedor: clientes vinculados a ele (customer_sellers) ou que compraram com ele;
 *    histórico e classificação consideram SÓ os pedidos dele (não expõe vendas de colegas).
 * Só clientes com ao menos uma compra registrada são classificados.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { ACTIVE_CLASSES, classifyCustomer, type CustomerClass, type CustomerMetrics } from "@/lib/metrics/customers";
import { lastMonths } from "@/lib/periods";
import { getSetting } from "@/lib/settings";
import { rowsOf } from "@/lib/db/rows";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export interface CustomerRow extends CustomerMetrics {
  customerId: string | null;
  pedidookId: number;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  /** Vendedor(es) responsável(eis): associação oficial; senão, vendedor do último pedido. */
  sellerNames: string | null;
  sellerIds: string[];
}

async function statusList(db: Database) {
  const statuses = await getSetting(db, "revenue.statuses");
  return sql.join((statuses.length ? statuses : ["pedido"]).map((s) => sql`${s}`), sql`, `);
}

/** Carrega e classifica os clientes na data `asOf`. */
export async function classifyCustomers(db: Database, opts: { asOf: string; sellerId?: string | null; customerId?: string }): Promise<CustomerRow[]> {
  const params = await getSetting(db, "customers.classification");
  const st = await statusList(db);
  const sellerOrders = opts.sellerId ? sql`and o.seller_id = ${opts.sellerId}` : sql``;
  // Vendedor: o histórico considera só pedidos dele; logo só aparecem clientes que já compraram com ele.
  const oneCustomer = opts.customerId ? sql`and c.id = ${opts.customerId}` : sql``;

  const res = await db.execute(sql`
    with h as (
      select o.customer_pedidook_id,
        json_agg(json_build_object('d', o.order_date::text, 'a', o.net_amount) order by o.order_date) as orders,
        (array_agg(o.seller_id order by o.order_date desc))[1] as last_seller_id
      from orders o
      where o.deleted_in_source = false and o.status in (${st}) and o.order_date <= ${opts.asOf} ${sellerOrders}
      group by o.customer_pedidook_id
    ),
    links as (
      select cs.customer_id, string_agg(distinct s.name, ', ') as names, array_agg(distinct s.id::text) as ids
      from customer_sellers cs join sellers s on s.id = cs.seller_id
      group by cs.customer_id
    )
    select h.customer_pedidook_id as pid, h.orders, c.id as customer_id, c.corporate_name, c.trade_name, c.cnpj, c.phone,
      c.city, c.state, c.segment,
      coalesce(l.names, ls.name) as seller_names,
      coalesce(l.ids, case when ls.id is null then array[]::text[] else array[ls.id::text] end) as seller_ids
    from h
    left join customers c on c.pedidook_id = h.customer_pedidook_id
    left join links l on l.customer_id = c.id
    left join sellers ls on ls.id = h.last_seller_id
    where true ${oneCustomer}`);

  type Raw = {
    pid: number;
    orders: { d: string; a: string | number }[] | string;
    customer_id: string | null;
    corporate_name: string | null;
    trade_name: string | null;
    cnpj: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    segment: string | null;
    seller_names: string | null;
    seller_ids: string[] | string | null;
  };

  return rowsOf<Raw>(res).map((r) => {
    const orders = (typeof r.orders === "string" ? JSON.parse(r.orders) : r.orders) as { d: string; a: string | number }[];
    const ids = Array.isArray(r.seller_ids) ? r.seller_ids : typeof r.seller_ids === "string" ? r.seller_ids.replace(/[{}]/g, "").split(",").filter(Boolean) : [];
    return {
      customerId: r.customer_id,
      pedidookId: num(r.pid),
      name: r.corporate_name ?? `Cliente #${r.pid} (não importado)`,
      tradeName: r.trade_name,
      cnpj: r.cnpj,
      phone: r.phone,
      city: r.city,
      state: r.state,
      segment: r.segment,
      sellerNames: r.seller_names,
      sellerIds: ids,
      ...classifyCustomer(orders.map((o) => ({ date: o.d, amount: num(o.a) })), opts.asOf, params),
    };
  });
}

export function classCounts(rows: CustomerRow[]) {
  const counts: Record<CustomerClass, number> = { novo: 0, recuperado: 0, inativo: 0, em_risco: 0, recorrente: 0, ativo: 0 };
  for (const r of rows) counts[r.class]++;
  return {
    ...counts,
    total: rows.length,
    active: ACTIVE_CLASSES.reduce((s, c) => s + counts[c], 0),
    /** Faturamento médio mensal dos clientes em risco + inativos (valor em jogo). */
    atStakeMonthly: Math.round(rows.filter((r) => r.class === "em_risco" || r.class === "inativo").reduce((s, r) => s + r.monthlyRevenue, 0) * 100) / 100,
  };
}

// ------------------------------------------------------------------ filtros / oportunidades

export interface CustomerFilter {
  classe?: CustomerClass | "oportunidades";
  sellerId?: string | null;
  cidade?: string;
  uf?: string;
  faturamentoMin?: number;
  diasSemComprarMin?: number;
  busca?: string;
}

const norm = (v: string | null | undefined) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function filterCustomers(rows: CustomerRow[], f: CustomerFilter): CustomerRow[] {
  let list = rows;
  if (f.classe === "oportunidades") list = list.filter((r) => r.class === "em_risco" || r.class === "inativo");
  else if (f.classe) list = list.filter((r) => r.class === f.classe);
  if (f.sellerId) list = list.filter((r) => r.sellerIds.includes(f.sellerId!));
  if (f.cidade) list = list.filter((r) => norm(r.city).includes(norm(f.cidade)));
  if (f.uf) list = list.filter((r) => norm(r.state) === norm(f.uf));
  if (f.faturamentoMin) list = list.filter((r) => r.totalRevenue >= f.faturamentoMin!);
  if (f.diasSemComprarMin) list = list.filter((r) => (r.daysWithoutBuying ?? 0) >= f.diasSemComprarMin!);
  if (f.busca) {
    const t = norm(f.busca);
    const digits = f.busca.replace(/\D/g, "");
    list = list.filter((r) => norm(r.name).includes(t) || norm(r.tradeName).includes(t) || (digits.length >= 3 && (r.cnpj ?? "").includes(digits)));
  }
  // Oportunidades: maior valor mensal em jogo primeiro; demais: maior faturamento acumulado
  return [...list].sort((a, b) =>
    f.classe === "oportunidades" || f.classe === "em_risco" || f.classe === "inativo"
      ? b.monthlyRevenue - a.monthlyRevenue
      : b.totalRevenue - a.totalRevenue,
  );
}

// ------------------------------------------------------------------ detalhe do cliente

export async function customerOrderHistory(db: Database, opts: { customerPedidookId: number; sellerId?: string | null; limit?: number }) {
  const sellerCond = opts.sellerId ? sql`and o.seller_id = ${opts.sellerId}` : sql``;
  const res = await db.execute(sql`
    select o.id, o.pedidook_id, o.number, o.order_date::text as order_date, o.status, o.situation, o.net_amount, o.deleted_in_source, s.name as seller_name,
      (select count(*)::int from order_items i where i.order_id = o.id and i.deleted_in_source = false) as items
    from orders o left join sellers s on s.id = o.seller_id
    where o.customer_pedidook_id = ${opts.customerPedidookId} ${sellerCond}
    order by o.order_date desc, o.pedidook_id desc
    limit ${opts.limit ?? 50}`);
  return rowsOf<{
    id: string;
    pedidook_id: number;
    number: number | null;
    order_date: string;
    status: string;
    situation: string | null;
    net_amount: string;
    deleted_in_source: boolean;
    seller_name: string | null;
    items: number;
  }>(res).map((r) => ({ ...r, net_amount: num(r.net_amount) }));
}

/** Produtos que o cliente costuma comprar (frequência em pedidos de faturamento). */
export async function customerUsualProducts(db: Database, opts: { customerPedidookId: number; sellerId?: string | null; limit?: number }) {
  const st = await statusList(db);
  const sellerCond = opts.sellerId ? sql`and o.seller_id = ${opts.sellerId}` : sql``;
  const res = await db.execute(sql`
    select i.product_pedidook_id as pid, coalesce(p.name, 'Produto #' || i.product_pedidook_id) as name, p.sku,
      count(distinct o.id)::int as orders, sum(i.quantity) as quantity, sum(i.total_amount) as amount, max(o.order_date)::text as last_bought
    from order_items i
    join orders o on o.id = i.order_id
    left join products p on p.pedidook_id = i.product_pedidook_id
    where o.customer_pedidook_id = ${opts.customerPedidookId} and o.deleted_in_source = false and i.deleted_in_source = false
      and o.status in (${st}) ${sellerCond}
    group by i.product_pedidook_id, p.name, p.sku
    order by count(distinct o.id) desc, sum(i.total_amount) desc
    limit ${opts.limit ?? 10}`);
  return rowsOf<{ pid: number; name: string; sku: string | null; orders: number; quantity: string; amount: string; last_bought: string }>(res).map((r) => ({
    ...r,
    quantity: num(r.quantity),
    amount: num(r.amount),
  }));
}

/** Faturamento mensal do cliente (12 meses). */
export async function customerMonthly(db: Database, opts: { customerPedidookId: number; end: string; sellerId?: string | null }) {
  const st = await statusList(db);
  const months = lastMonths(opts.end, 12);
  const sellerCond = opts.sellerId ? sql`and seller_id = ${opts.sellerId}` : sql``;
  const res = await db.execute(sql`
    select to_char(order_date, 'YYYY-MM') as month, sum(net_amount) as revenue, count(*)::int as orders
    from orders
    where customer_pedidook_id = ${opts.customerPedidookId} and deleted_in_source = false and status in (${st})
      and order_date >= ${`${months[0]}-01`} and order_date <= ${opts.end} ${sellerCond}
    group by 1`);
  const map = new Map(rowsOf<{ month: string; revenue: string; orders: number }>(res).map((r) => [r.month, r]));
  return months.map((m) => {
    const r = map.get(m);
    const revenue = num(r?.revenue);
    const orders = r?.orders ?? 0;
    return { month: m, revenue, orders, averageTicket: orders ? Math.round((revenue / orders) * 100) / 100 : null };
  });
}

/** O vendedor pode ver este cliente? (vinculado a ele ou comprou com ele) */
export async function sellerCanSeeCustomer(db: Database, sellerId: string, customerPedidookId: number): Promise<boolean> {
  const res = await db.execute(sql`
    select (
      exists (select 1 from orders o where o.customer_pedidook_id = ${customerPedidookId} and o.seller_id = ${sellerId})
      or exists (select 1 from customer_sellers cs join customers c on c.id = cs.customer_id
                 where c.pedidook_id = ${customerPedidookId} and cs.seller_id = ${sellerId})
    ) as ok`);
  return !!rowsOf<{ ok: boolean }>(res)[0]?.ok;
}
