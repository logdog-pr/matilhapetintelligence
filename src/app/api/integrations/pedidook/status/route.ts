import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { configStatus } from "@/lib/env";
import { getSyncHealth } from "@/lib/queries/sync-health";

/** GET /api/integrations/pedidook/status — saúde da integração (sem expor tokens). */
export const GET = apiRoute({ permission: "integration:view" }, async () => {
  const health = await getSyncHealth(getDb());
  return { credentialsConfigured: configStatus().pedidook, ...health };
});
