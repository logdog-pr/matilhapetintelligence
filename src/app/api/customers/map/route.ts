import { apiRoute } from "@/lib/api/handler";
import { customersMap, customersQuerySchema } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";

/** GET /api/customers/map — pontos e regiões para o mapa de calor (mesmos filtros e escopo de /api/customers). */
export const GET = apiRoute({ permission: "customers:view" }, async ({ req, user }) => {
  const q = customersQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return customersMap(getDb(), user, q);
});
