/**
 * Motor de promoções (Fase 4, spec §12): gera, persiste e decide sugestões.
 * As sugestões NUNCA alteram preços no PedidoOK (modo somente leitura).
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { products, promotions, users } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { rowsOf } from "@/lib/db/rows";
import { suggestBundle, suggestForProduct, type ProductSignal, type PromotionType, type Suggestion } from "@/lib/metrics/promotions";
import { addDays } from "@/lib/periods";
import { getSetting } from "@/lib/settings";
import { getStockAnalysis } from "./stock";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const MAX_BUNDLES = 30;
const DECISION_MEMORY_DAYS = 30;

/** Calcula as sugestões atuais (sem gravar). */
export async function computeSuggestions(db: Database, today: string): Promise<Suggestion[]> {
  const params = await getSetting(db, "promotions.params");
  const { rows } = await getStockAnalysis(db, { today });
  const signals = new Map<number, ProductSignal>();
  for (const r of rows) {
    signals.set(r.pedidookId, {
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      currentStock: r.currentStock,
      minimumStock: r.minimumStock,
      unitCost: r.unitCost,
      salePrice: r.salePrice,
      avgDailyDemand: r.avgDailyDemand,
      sold30: r.sold30,
      sold60: r.sold60,
      status: r.status,
      daysSinceLastSale: r.daysSinceLastSale,
    });
  }

  const out: Suggestion[] = [];
  for (const s of signals.values()) {
    const sug = suggestForProduct(s, params);
    if (sug) out.push(sug);
  }

  // Produtos frequentemente vendidos juntos (90 dias)
  const statuses = await getSetting(db, "revenue.statuses");
  const st = sql.join((statuses.length ? statuses : ["pedido"]).map((x) => sql`${x}`), sql`, `);
  const since = addDays(today, -89);
  const res = await db.execute(sql`
    with oi as (
      select distinct i.order_id, i.product_pedidook_id as pid
      from order_items i join orders o on o.id = i.order_id
      where i.deleted_in_source = false and o.deleted_in_source = false and o.status in (${st})
        and o.order_date between ${since} and ${today}
    ),
    freq as (select pid, count(*)::int as n from oi group by pid)
    select a.pid as a, b.pid as b, count(*)::int as together, fa.n as orders_with_a
    from oi a join oi b on a.order_id = b.order_id and a.pid <> b.pid
    join freq fa on fa.pid = a.pid
    group by a.pid, b.pid, fa.n
    having count(*) >= ${params.bundleMinSupport}`);

  const bestByB = new Map<number, { suggestion: Suggestion; confidence: number }>();
  for (const p of rowsOf<{ a: number; b: number; together: number; orders_with_a: number }>(res)) {
    const a = signals.get(Number(p.a));
    const b = signals.get(Number(p.b));
    if (!a || !b) continue;
    const sug = suggestBundle({ a, b, together: p.together, ordersWithA: p.orders_with_a }, params);
    if (!sug) continue;
    const confidence = p.together / p.orders_with_a;
    const cur = bestByB.get(Number(p.b));
    if (!cur || confidence > cur.confidence) bestByB.set(Number(p.b), { suggestion: sug, confidence });
  }
  out.push(
    ...[...bestByB.values()]
      .map((x) => x.suggestion)
      .sort((x, y) => y.impact - x.impact)
      .slice(0, MAX_BUNDLES),
  );
  return out;
}

/**
 * Regera as sugestões: remove as pendentes ("sugerida") e grava as atuais.
 * Combinações produto+tipo decididas nos últimos 30 dias não são sugeridas de novo.
 */
export async function generatePromotions(db: Database, today: string) {
  const suggestions = await computeSuggestions(db, today);
  const decided = await db
    .select({ productId: promotions.productId, type: promotions.promotionType, related: promotions.relatedProductId })
    .from(promotions)
    .where(and(inArray(promotions.status, ["aprovada", "rejeitada"]), gte(promotions.decidedAt, new Date(Date.now() - DECISION_MEMORY_DAYS * 86_400_000))));
  const key = (p: string | null, t: string, r: string | null) => `${p}|${t}|${r ?? ""}`;
  const skip = new Set(decided.map((d) => key(d.productId, d.type, d.related)));
  const fresh = suggestions.filter((s) => !skip.has(key(s.productId, s.type, s.relatedProductId)));

  await db.transaction(async (tx) => {
    await tx.delete(promotions).where(eq(promotions.status, "sugerida"));
    if (fresh.length) {
      await tx.insert(promotions).values(
        fresh.map((s) => ({
          productId: s.productId,
          relatedProductId: s.relatedProductId,
          promotionType: s.type,
          situation: s.situation,
          currentStock: s.currentStock === null ? null : String(s.currentStock),
          unitCost: s.unitCost.toFixed(2),
          currentPrice: s.currentPrice.toFixed(2),
          suggestedPrice: s.suggestedPrice.toFixed(2),
          discountPct: s.discountPct.toFixed(4),
          minimumMargin: s.estimatedMarginPct.toFixed(4),
          estimatedQuantity: String(s.potentialQty),
          estimatedRevenue: s.estimatedRevenue.toFixed(2),
          estimatedProfit: s.estimatedProfit.toFixed(2),
          capitalFreed: s.capitalFreed === null ? null : s.capitalFreed.toFixed(2),
          impactEstimate: s.impact.toFixed(2),
          reasoning: s.reasoning.join("\n"),
          status: "sugerida",
        })),
      );
    }
  });
  return { generated: fresh.length, skippedRecentlyDecided: suggestions.length - fresh.length };
}

export type PromotionStatus = "sugerida" | "aprovada" | "rejeitada";

export interface PromotionRow {
  id: string;
  type: PromotionType;
  status: PromotionStatus;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  relatedProductName: string | null;
  relatedSku: string | null;
  situation: string | null;
  currentStock: number | null;
  unitCost: number | null;
  currentPrice: number | null;
  suggestedPrice: number | null;
  discountPct: number | null;
  estimatedMarginPct: number | null;
  potentialQty: number | null;
  estimatedRevenue: number | null;
  estimatedProfit: number | null;
  capitalFreed: number | null;
  reasoning: string[];
  createdAt: Date;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
}

export async function listPromotions(db: Database, f: { status?: PromotionStatus; type?: PromotionType }): Promise<PromotionRow[]> {
  const related = alias(products, "related");
  const rows = await db
    .select({
      p: promotions,
      productName: products.name,
      sku: products.sku,
      relatedProductName: related.name,
      relatedSku: related.sku,
      decidedByName: users.name,
    })
    .from(promotions)
    .leftJoin(products, eq(products.id, promotions.productId))
    .leftJoin(related, eq(related.id, promotions.relatedProductId))
    .leftJoin(users, eq(users.id, promotions.decidedBy))
    .where(and(f.status ? eq(promotions.status, f.status) : undefined, f.type ? eq(promotions.promotionType, f.type) : undefined))
    .orderBy(desc(promotions.impactEstimate), desc(promotions.createdAt))
    .limit(500);
  return rows.map(({ p, ...r }) => ({
    id: p.id,
    type: p.promotionType as PromotionType,
    status: p.status as PromotionStatus,
    productId: p.productId,
    productName: r.productName,
    sku: r.sku,
    relatedProductName: r.relatedProductName,
    relatedSku: r.relatedSku,
    situation: p.situation,
    currentStock: num(p.currentStock),
    unitCost: num(p.unitCost),
    currentPrice: num(p.currentPrice),
    suggestedPrice: num(p.suggestedPrice),
    discountPct: num(p.discountPct),
    estimatedMarginPct: num(p.minimumMargin),
    potentialQty: num(p.estimatedQuantity),
    estimatedRevenue: num(p.estimatedRevenue),
    estimatedProfit: num(p.estimatedProfit),
    capitalFreed: num(p.capitalFreed),
    reasoning: (p.reasoning ?? "").split("\n").filter(Boolean),
    createdAt: p.createdAt,
    decidedAt: p.decidedAt,
    decidedByName: r.decidedByName,
    decisionNote: p.decisionNote,
  }));
}

export async function decidePromotion(db: Database, id: string, status: "aprovada" | "rejeitada", userId: string, note?: string | null) {
  const [row] = await db
    .update(promotions)
    .set({ status, decidedBy: userId, decidedAt: new Date(), decisionNote: note ?? null })
    .where(and(eq(promotions.id, id), eq(promotions.status, "sugerida")))
    .returning({ id: promotions.id, status: promotions.status });
  return row ?? null;
}

export function promotionTotals(rows: PromotionRow[]) {
  const sum = (f: (r: PromotionRow) => number | null) => Math.round(rows.reduce((s, r) => s + (f(r) ?? 0), 0) * 100) / 100;
  return { count: rows.length, revenue: sum((r) => r.estimatedRevenue), profit: sum((r) => r.estimatedProfit), capital: sum((r) => r.capitalFreed) };
}
