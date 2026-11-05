import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { stockPage } from "@/lib/stock-service";

const query = z.object({ busca: z.string().trim().max(80).optional(), pagina: z.coerce.number().int().min(1).max(10_000).optional() });

/** GET /api/products — produtos ativos com estoque e indicadores de reposição (ADMIN/GESTOR). */
export const GET = apiRoute({ permission: "stock:view" }, async ({ req }) => {
  const q = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const r = await stockPage(getDb(), { relatorio: "todos", busca: q.busca, pagina: q.pagina });
  return { products: r.rows, total: r.total, page: r.page, pages: r.pages, params: r.params, history: r.history };
});
