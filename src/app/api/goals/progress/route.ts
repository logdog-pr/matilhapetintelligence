import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { goalsForUser } from "@/lib/goals-service";

const query = z.object({ seller_id: z.uuid().optional() });

/** GET /api/goals/progress — metas do mês corrente com progresso (VENDEDOR: só a própria). */
export const GET = apiRoute({ permission: "goals:view" }, async ({ req, user }) => {
  const q = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return goalsForUser(getDb(), user, { sellerId: q.seller_id });
});
