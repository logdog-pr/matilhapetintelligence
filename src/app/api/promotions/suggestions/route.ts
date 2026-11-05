import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { listPromotions, promotionTotals } from "@/lib/queries/promotions";

const query = z.object({
  status: z.enum(["sugerida", "aprovada", "rejeitada"]).default("sugerida"),
  tipo: z.enum(["parado", "excesso", "queda_vendas", "margem_alta", "venda_casada"]).optional(),
});

/** GET /api/promotions/suggestions — sugestões do motor (nunca alteram preços no PedidoOK). */
export const GET = apiRoute({ permission: "promotions:view" }, async ({ req }) => {
  const q = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await listPromotions(getDb(), { status: q.status, type: q.tipo });
  return { totals: promotionTotals(rows), suggestions: rows };
});
