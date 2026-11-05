import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { stockPage, stockQuerySchema } from "@/lib/stock-service";

/** GET /api/products/stock — análise de estoque de todos os produtos (filtros: relatorio, busca, fornecedor, pagina). */
export const GET = apiRoute({ permission: "stock:view" }, async ({ req }) => {
  const q = stockQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return stockPage(getDb(), { ...q, relatorio: q.relatorio ?? "todos" });
});
