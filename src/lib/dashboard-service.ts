/**
 * Monta os dados do Dashboard conforme o perfil do usuário.
 * - VENDEDOR: escopo forçado ao próprio vendedor; sem margem/lucro, sem estoque,
 *   sem ranking de outros vendedores.
 * - GESTOR/ADMIN: empresa inteira ou um vendedor escolhido.
 */
import { z } from "zod";
import { can, scopeSellerId, type Principal } from "@/lib/auth/rbac";
import type { Database } from "@/lib/db/types";
import { todayInSaoPaulo } from "@/lib/format";
import { PERIOD_PRESETS, resolvePeriod, type Period } from "@/lib/periods";
import {
  getDailySeries,
  getMonthlySeries,
  getOverview,
  getSellerPerformance,
  getTopCategories,
  getTopProducts,
  listRevenueOrders,
} from "@/lib/queries/dashboard";

export const dashboardQuerySchema = z.object({
  p: z.enum(PERIOD_PRESETS).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vendedor: z.uuid().optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export interface DashboardScope {
  period: Period;
  sellerId: string | null;
  company: boolean;
  canSeeMargin: boolean;
  canSeeStock: boolean;
  canCompareSellers: boolean;
}

export function resolveScope(user: Principal, q: DashboardQuery, now = new Date()): DashboardScope {
  const today = todayInSaoPaulo(now);
  const sellerId = scopeSellerId(user, q.vendedor ?? null);
  const company = can(user, "dashboard:company");
  return {
    period: resolvePeriod(q.p, today, { start: q.de, end: q.ate }),
    sellerId,
    company,
    canSeeMargin: company,
    canSeeStock: company,
    canCompareSellers: can(user, "sellers:view_all"),
  };
}

export async function dashboardOverview(db: Database, s: DashboardScope) {
  const ov = await getOverview(db, {
    start: s.period.start,
    end: s.period.end,
    previous: s.period.previous,
    sellerId: s.sellerId,
    includeCompanyOnly: s.canSeeStock,
  });
  if (!s.canSeeMargin) {
    ov.grossProfit = null;
    ov.grossMarginPct = null;
    ov.costCoveragePct = null;
  }
  return ov;
}

export async function dashboardSales(db: Database, s: DashboardScope) {
  const [daily, monthly] = await Promise.all([
    getDailySeries(db, { start: s.period.start, end: s.period.end, previous: s.period.previous, sellerId: s.sellerId }),
    getMonthlySeries(db, { end: s.period.end, sellerId: s.sellerId, months: 12 }),
  ]);
  return { daily, monthly };
}

export async function dashboardPerformance(db: Database, s: DashboardScope) {
  if (!s.canCompareSellers) return [];
  return getSellerPerformance(db, { start: s.period.start, end: s.period.end, previous: s.period.previous });
}

export async function dashboardTopProducts(db: Database, s: DashboardScope) {
  const f = { start: s.period.start, end: s.period.end, sellerId: s.sellerId };
  const [products, categories] = await Promise.all([getTopProducts(db, { ...f, limit: 10 }), getTopCategories(db, { ...f, limit: 8 })]);
  return { products, categories };
}

export async function dashboardOrders(db: Database, s: DashboardScope, page = 1) {
  return listRevenueOrders(db, { start: s.period.start, end: s.period.end, sellerId: s.sellerId, page, showCost: s.canSeeMargin });
}
