import { can, scopeSellerId, type Principal } from "@/lib/auth/rbac";
import type { Database } from "@/lib/db/types";
import { monthBounds, todayInSaoPaulo } from "@/lib/format";
import { listGoalsWithProgress } from "@/lib/queries/goals";

/**
 * Metas visíveis ao usuário, já com progresso.
 * VENDEDOR: só as próprias (nunca a da empresa nem as de outros vendedores).
 */
export async function goalsForUser(
  db: Database,
  user: Principal,
  q: { from?: string; to?: string; month?: string; sellerId?: string | null },
  now = new Date(),
) {
  const today = todayInSaoPaulo(now);
  const bounds = q.month ? monthBounds(`${q.month}-01`) : q.from && q.to ? { start: q.from, end: q.to } : monthBounds(today);
  const seller = scopeSellerId(user, q.sellerId);
  const includeCompany = can(user, "goals:view_all") && !seller;
  return {
    period: bounds,
    today,
    goals: await listGoalsWithProgress(db, {
      from: bounds.start,
      to: bounds.end,
      today,
      scope: { seller: seller ?? "all", includeCompany },
    }),
  };
}
