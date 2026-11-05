import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { stockPage, stockQuerySchema } from "@/lib/stock-service";

/** GET /api/products/slow-moving — produtos parados (estoque sem venda há mais de N dias). */
export const GET = apiRoute({ permission: "stock:view" }, async ({ req }) => {
  const q = stockQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return stockPage(getDb(), { ...q, relatorio: "parados" });
});
