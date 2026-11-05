import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { decidePromotion } from "@/lib/queries/promotions";

const body = z.object({ note: z.string().trim().max(500).nullish() });

/** Handler comum de aprovar/rejeitar (registra a decisão; não altera preços no PedidoOK). */
export function promotionDecisionRoute(status: "aprovada" | "rejeitada") {
  return apiRoute<{ id: string }>({ permission: "promotions:manage" }, async ({ req, user, params }) => {
    const id = z.uuid().parse(params.id);
    const { note } = body.parse(await req.json().catch(() => ({})));
    const db = getDb();
    const row = await decidePromotion(db, id, status, user.id, note);
    if (!row) throw new HttpError(409, "Sugestão não encontrada ou já decidida.");
    await audit(db, user.id, `promotion.${status}`, "promotions", id, { note: note ?? null });
    return row;
  });
}
