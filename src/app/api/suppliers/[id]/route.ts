import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { suppliers } from "@/lib/db/schema";

const body = z.object({ leadTimeDays: z.number().int().min(0).max(365).nullable() });

/** PATCH /api/suppliers/:id — prazo de entrega (configuração manual; não existe na API do PedidoOK). */
export const PATCH = apiRoute<{ id: string }>({ permission: "stock:manage" }, async ({ req, user, params }) => {
  const id = z.uuid().parse(params.id);
  const input = body.parse(await req.json());
  const db = getDb();
  const [row] = await db.update(suppliers).set({ leadTimeDays: input.leadTimeDays, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning({ id: suppliers.id, leadTimeDays: suppliers.leadTimeDays });
  if (!row) throw new HttpError(404, "Fornecedor não encontrado.");
  await audit(db, user.id, "supplier.lead_time", "suppliers", id, input);
  return row;
});
