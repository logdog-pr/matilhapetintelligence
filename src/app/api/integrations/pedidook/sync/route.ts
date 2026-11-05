import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { configStatus } from "@/lib/env";
import { RESOURCE_ORDER, type ResourceKey } from "@/lib/pedidook/resources";
import { createPedidookClient } from "@/lib/pedidook/service";
import { runDueResources } from "@/lib/pedidook/sync";

export const maxDuration = 60;

const body = z.object({
  mode: z.enum(["full", "incremental"]).default("incremental"),
  resources: z.array(z.enum(RESOURCE_ORDER as [ResourceKey, ...ResourceKey[]])).optional(),
});

/**
 * POST /api/integrations/pedidook/sync — sincronização manual (somente ADMIN).
 * mode "full" = importação histórica (retomável: chame novamente até concluir).
 */
export const POST = apiRoute({ permission: "integration:manage", rateLimit: { limit: 6, windowMs: 60_000 } }, async ({ req, user }) => {
  if (!configStatus().pedidook) throw new HttpError(503, "Credenciais do PedidoOK não configuradas.");
  const input = body.parse(await req.json().catch(() => ({})));
  const db = getDb();
  const client = await createPedidookClient(db);
  await audit(db, user.id, `sync.${input.mode}`, "pedidook", null, { resources: input.resources ?? "todos" });
  const results = await runDueResources(db, client, {
    mode: input.mode,
    trigger: "manual",
    deadline: Date.now() + 45_000,
    only: input.resources,
  });
  return { results, done: results.every((r) => r.status === "success") };
});
