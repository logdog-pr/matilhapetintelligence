import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { todayInSaoPaulo } from "@/lib/format";
import { addDays } from "@/lib/periods";
import { getStockAnalysis, productDailySales } from "@/lib/queries/stock";

/** GET /api/products/:id/performance — análise de reposição do SKU, com o passo a passo e as vendas diárias (90 dias). */
export const GET = apiRoute<{ id: string }>({ permission: "stock:view" }, async ({ params }) => {
  const id = z.uuid().parse(params.id);
  const db = getDb();
  const today = todayInSaoPaulo();
  const { rows, params: stockParams, history } = await getStockAnalysis(db, { today, productId: id });
  const product = rows[0];
  if (!product) throw new HttpError(404, "Produto não encontrado.");
  const daily = await productDailySales(db, product.pedidookId, addDays(today, -89), today);
  return { product, params: stockParams, history, daily };
});
