import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { dashboardQuerySchema, dashboardOrders, resolveScope } from "@/lib/dashboard-service";

/** GET /api/dashboard/orders — pedidos que compõem o faturamento (paginado). Parâmetros: p, de, ate, vendedor. */
export const GET = apiRoute({ permission: "dashboard:view" }, async ({ req, user }) => {
  const q = dashboardQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const scope = resolveScope(user, q);
  const db = getDb();
  return { period: scope.period, sellerId: scope.sellerId, data: await dashboardOrders(db, scope, q.pagina ?? 1) };
});
