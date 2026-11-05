import { and, asc, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { salesGoals, sellers } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { computeGoalProgress, type GoalProgress } from "@/lib/metrics/goals";
import { getSetting } from "@/lib/settings";
import { countNewCustomers, getRevenueSummary } from "./revenue";

export interface GoalWithProgress {
  id: string;
  sellerId: string | null;
  sellerName: string | null;
  periodKind: "MENSAL" | "SEMANAL" | "PERSONALIZADO";
  dayMode: "CORRIDOS" | "UTEIS";
  periodStart: string;
  periodEnd: string;
  targetRevenue: number | null;
  targetOrders: number | null;
  targetNewCustomers: number | null;
  revenue: GoalProgress;
  orders: { realized: number; target: number | null; percent: number | null };
  newCustomers: { realized: number; target: number | null; percent: number | null };
}

export interface GoalScope {
  /** "all" = empresa + todos os vendedores; string = somente esse vendedor */
  seller: "all" | string;
  includeCompany: boolean;
}

/** Metas vigentes em `date` (ou que se sobrepõem ao intervalo), com progresso calculado. */
export async function listGoalsWithProgress(
  db: Database,
  opts: { from: string; to: string; today: string; scope: GoalScope },
): Promise<GoalWithProgress[]> {
  const sellerCond =
    opts.scope.seller === "all"
      ? opts.scope.includeCompany
        ? undefined
        : isNotNull(salesGoals.sellerId)
      : opts.scope.includeCompany
        ? or(eq(salesGoals.sellerId, opts.scope.seller), isNull(salesGoals.sellerId))
        : eq(salesGoals.sellerId, opts.scope.seller);

  const rows = await db
    .select({ goal: salesGoals, sellerName: sellers.name })
    .from(salesGoals)
    .leftJoin(sellers, eq(sellers.id, salesGoals.sellerId))
    .where(and(lte(salesGoals.periodStart, opts.to), gte(salesGoals.periodEnd, opts.from), sellerCond))
    .orderBy(asc(salesGoals.periodStart), asc(sellers.name));

  const holidays = await getSetting(db, "goals.holidays");
  const pct = (r: number, t: number | null) => (t && t > 0 ? Math.round((r / t) * 10000) / 100 : null);

  return Promise.all(
    rows.map(async ({ goal: g, sellerName }) => {
      const filter = { start: g.periodStart, end: g.periodEnd, sellerId: g.sellerId };
      const [summary, newCustomers] = await Promise.all([getRevenueSummary(db, filter), countNewCustomers(db, filter)]);
      const targetRevenue = g.targetRevenue === null ? null : Number(g.targetRevenue);
      return {
        id: g.id,
        sellerId: g.sellerId,
        sellerName: sellerName ?? null,
        periodKind: g.periodKind,
        dayMode: g.dayMode,
        periodStart: g.periodStart,
        periodEnd: g.periodEnd,
        targetRevenue,
        targetOrders: g.targetOrders,
        targetNewCustomers: g.targetNewCustomers,
        revenue: computeGoalProgress({
          target: targetRevenue,
          realized: summary.revenue,
          periodStart: g.periodStart,
          periodEnd: g.periodEnd,
          today: opts.today,
          dayMode: g.dayMode,
          holidays,
        }),
        orders: { realized: summary.orders, target: g.targetOrders, percent: pct(summary.orders, g.targetOrders) },
        newCustomers: { realized: newCustomers, target: g.targetNewCustomers, percent: pct(newCustomers, g.targetNewCustomers) },
      };
    }),
  );
}
