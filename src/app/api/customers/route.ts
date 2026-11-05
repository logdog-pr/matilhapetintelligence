import { apiRoute } from "@/lib/api/handler";
import { customersPage, customersQuerySchema } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";

/** GET /api/customers — clientes classificados (filtros: classe, vendedor, cidade, uf, faturamento_min, dias_min, busca, pagina). */
export const GET = apiRoute({ permission: "customers:view" }, async ({ req, user }) => {
  const q = customersQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return customersPage(getDb(), user, q);
});
