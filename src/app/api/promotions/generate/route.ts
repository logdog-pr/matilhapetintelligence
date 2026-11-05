import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { todayInSaoPaulo } from "@/lib/format";
import { generatePromotions } from "@/lib/queries/promotions";

export const maxDuration = 60;

/** POST /api/promotions/generate — recalcula as sugestões pendentes. */
export const POST = apiRoute({ permission: "promotions:manage", rateLimit: { limit: 6, windowMs: 60_000 } }, async ({ user }) => {
  const db = getDb();
  const result = await generatePromotions(db, todayInSaoPaulo());
  await audit(db, user.id, "promotions.generate", "promotions", null, result);
  return result;
});
