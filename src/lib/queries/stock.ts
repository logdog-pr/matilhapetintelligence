/**
 * Consultas de estoque (Fase 3): vendas por SKU em janelas até hoje + cálculo de reposição.
 * Vendas = itens não excluídos de pedidos que contam como faturamento.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { products, suppliers } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { analyzeStock, type StockAnalysis, type StockParams, type StockStatus } from "@/lib/metrics/stock";
import { addDays, daysBetween, eachDay } from "@/lib/periods";
import { getSetting } from "@/lib/settings";
import { rowsOf } from "@/lib/db/rows";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface StockRow extends StockAnalysis {
  productId: string;
  pedidookId: number;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  packaging: string | null;
  currentStock: number | null;
  minimumStock: number | null;
  unitCost: number | null;
  salePrice: number | null;
  supplierId: string | null;
  supplierName: string | null;
  sold7: number;
  sold30: number;
  sold60: number;
  sold90: number;
  soldWindow: number;
  lastSaleDate: string | null;
}

async function revenueStatusList(db: Database) {
  const statuses = await getSetting(db, "revenue.statuses");
  return sql.join((statuses.length ? statuses : ["pedido"]).map((s) => sql`${s}`), sql`, `);
}

/** Dias de histórico de pedidos disponível (do 1º pedido importado até hoje). */
export async function historyDays(db: Database, today: string): Promise<{ days: number; since: string | null }> {
  const res = await db.execute(sql`select min(order_date)::text as first from orders where deleted_in_source = false`);
  const first = rowsOf<{ first: string | null }>(res)[0]?.first ?? null;
  return { days: first ? Math.max(0, daysBetween(first, today)) : 0, since: first };
}

/** Análise de estoque de todos os produtos ativos (ou de um produto). */
export async function getStockAnalysis(
  db: Database,
  opts: { today: string; productId?: string },
): Promise<{ rows: StockRow[]; params: StockParams; history: { days: number; since: string | null } }> {
  const params = await getSetting(db, "stock.params");
  const history = await historyDays(db, opts.today);
  const statusList = await revenueStatusList(db);
  const d = (n: number) => addDays(opts.today, -(n - 1));
  const productCond = opts.productId ? sql`and p.id = ${opts.productId}` : sql``;

  const res = await db.execute(sql`
    with sales as (
      select i.product_pedidook_id as pid, o.order_date, sum(i.quantity) as qty
      from order_items i
      join orders o on o.id = i.order_id
      where i.deleted_in_source = false and o.deleted_in_source = false
        and o.status in (${statusList})
        and o.order_date <= ${opts.today}
      group by i.product_pedidook_id, o.order_date
    )
    select
      p.id, p.pedidook_id, p.sku, p.name, p.brand, p.category, p.packaging,
      p.current_stock, p.minimum_stock, p.purchase_cost, p.sale_price,
      s.id as supplier_id, coalesce(s.trade_name, s.name) as supplier_name, s.lead_time_days,
      coalesce(sum(sa.qty) filter (where sa.order_date >= ${d(7)}), 0) as sold7,
      coalesce(sum(sa.qty) filter (where sa.order_date >= ${d(30)}), 0) as sold30,
      coalesce(sum(sa.qty) filter (where sa.order_date >= ${d(60)}), 0) as sold60,
      coalesce(sum(sa.qty) filter (where sa.order_date >= ${d(90)}), 0) as sold90,
      coalesce(sum(sa.qty) filter (where sa.order_date >= ${d(params.windowDays)}), 0) as sold_window,
      count(sa.order_date) filter (where sa.order_date >= ${d(params.windowDays)})::int as sale_days_window,
      max(sa.order_date)::text as last_sale
    from products p
    left join suppliers s on s.id = p.supplier_id
    left join sales sa on sa.pid = p.pedidook_id
    where p.deleted_in_source = false ${productCond}
    group by p.id, s.id
    order by p.name`);

  type Raw = {
    id: string;
    pedidook_id: number;
    sku: string;
    name: string;
    brand: string | null;
    category: string | null;
    packaging: string | null;
    current_stock: string | null;
    minimum_stock: string | null;
    purchase_cost: string | null;
    sale_price: string | null;
    supplier_id: string | null;
    supplier_name: string | null;
    lead_time_days: number | null;
    sold7: string;
    sold30: string;
    sold60: string;
    sold90: string;
    sold_window: string;
    sale_days_window: number;
    last_sale: string | null;
  };

  const rows = rowsOf<Raw>(res).map((r): StockRow => {
    const base = {
      currentStock: numOrNull(r.current_stock),
      minimumStock: numOrNull(r.minimum_stock),
      unitCost: numOrNull(r.purchase_cost),
      sold7: num(r.sold7),
      sold30: num(r.sold30),
      sold60: num(r.sold60),
      sold90: num(r.sold90),
      soldWindow: num(r.sold_window),
      lastSaleDate: r.last_sale,
    };
    const analysis = analyzeStock(
      {
        ...base,
        saleDaysWindow: num(r.sale_days_window),
        supplierLeadTimeDays: r.lead_time_days,
        historyDays: history.days,
        today: opts.today,
      },
      params,
    );
    return {
      productId: r.id,
      pedidookId: r.pedidook_id,
      sku: r.sku,
      name: r.name,
      brand: r.brand,
      category: r.category,
      packaging: r.packaging,
      salePrice: numOrNull(r.sale_price),
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      ...base,
      ...analysis,
    };
  });

  return { rows, params, history };
}

// ------------------------------------------------------------------ relatórios

export const STOCK_REPORTS = ["comprar", "ruptura", "excesso", "parados", "giro", "investimento", "todos"] as const;
export type StockReport = (typeof STOCK_REPORTS)[number];

export const STOCK_REPORT_LABELS: Record<StockReport, string> = {
  comprar: "Para comprar",
  ruptura: "Em ruptura",
  excesso: "Com excesso",
  parados: "Parados",
  giro: "Maior giro",
  investimento: "Maior investimento",
  todos: "Todos",
};

export const STATUS_LABELS: Record<StockStatus, string> = {
  ruptura: "Ruptura",
  comprar: "Comprar",
  excesso: "Excesso",
  parado: "Parado",
  ok: "OK",
  sem_giro: "Sem giro",
};

/** Filtra e ordena as linhas conforme o relatório (spec §11). */
export function stockReport(rows: StockRow[], report: StockReport): StockRow[] {
  switch (report) {
    case "comprar":
      return rows
        .filter((r) => (r.status === "comprar" || r.status === "ruptura") && (r.suggestedQty ?? 0) > 0)
        .sort((a, b) => (a.coverageDays ?? -1) - (b.coverageDays ?? -1) || (b.suggestedCost ?? 0) - (a.suggestedCost ?? 0));
    case "ruptura":
      return rows.filter((r) => r.status === "ruptura").sort((a, b) => b.avgDailyDemand - a.avgDailyDemand);
    case "excesso":
      return rows.filter((r) => r.status === "excesso").sort((a, b) => (b.coverageDays ?? 0) - (a.coverageDays ?? 0));
    case "parados":
      return rows.filter((r) => r.status === "parado").sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0));
    case "giro":
      return rows.filter((r) => r.avgDailyDemand > 0).sort((a, b) => b.avgDailyDemand - a.avgDailyDemand);
    case "investimento":
      return rows.filter((r) => (r.stockValue ?? 0) > 0).sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0));
    default:
      return rows;
  }
}

export function stockTotals(rows: StockRow[]) {
  const count = (s: StockStatus) => rows.filter((r) => r.status === s).length;
  return {
    products: rows.length,
    toBuy: rows.filter((r) => (r.status === "comprar" || r.status === "ruptura") && (r.suggestedQty ?? 0) > 0).length,
    rupture: count("ruptura"),
    excess: count("excesso"),
    idle: count("parado"),
    stockValue: Math.round(rows.reduce((s, r) => s + (r.stockValue ?? 0), 0) * 100) / 100,
    replenishmentCost: Math.round(rows.reduce((s, r) => s + ((r.status === "comprar" || r.status === "ruptura") && r.suggestedCost ? r.suggestedCost : 0), 0) * 100) / 100,
    idleValue: Math.round(rows.filter((r) => r.status === "parado").reduce((s, r) => s + (r.stockValue ?? 0), 0) * 100) / 100,
    lowQuality: rows.filter((r) => r.quality === "insuficiente").length,
  };
}

/** Vendas diárias de um produto (para o gráfico da página do SKU). */
export async function productDailySales(db: Database, productPedidookId: number, start: string, end: string) {
  const statusList = await revenueStatusList(db);
  const res = await db.execute(sql`
    select o.order_date::text as date, sum(i.quantity) as qty
    from order_items i join orders o on o.id = i.order_id
    where i.product_pedidook_id = ${productPedidookId} and i.deleted_in_source = false and o.deleted_in_source = false
      and o.status in (${statusList}) and o.order_date between ${start} and ${end}
    group by o.order_date`);
  const map = new Map(rowsOf<{ date: string; qty: string }>(res).map((r) => [r.date, num(r.qty)]));
  return eachDay(start, end).map((date) => ({ date, quantity: map.get(date) ?? 0 }));
}

/** Fornecedores com prazo de entrega (configuração manual). */
export async function listSuppliersWithLeadTime(db: Database) {
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      tradeName: suppliers.tradeName,
      leadTimeDays: suppliers.leadTimeDays,
      products: sql<number>`(select count(*)::int from ${products} p where p.supplier_id = ${suppliers.id} and p.deleted_in_source = false)`,
    })
    .from(suppliers)
    .where(and(eq(suppliers.deletedInSource, false)))
    .orderBy(asc(suppliers.name));
  return rows;
}
