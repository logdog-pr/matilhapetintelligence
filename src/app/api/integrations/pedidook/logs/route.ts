import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { getRecentSyncLogs } from "@/lib/queries/sync-health";

const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

/** GET /api/integrations/pedidook/logs */
export const GET = apiRoute({ permission: "integration:view" }, async ({ req }) => {
  const q = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return { logs: await getRecentSyncLogs(getDb(), q.limit) };
});
