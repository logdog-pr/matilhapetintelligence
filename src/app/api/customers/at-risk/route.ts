import { apiRoute } from "@/lib/api/handler";
import { customersPage, customersQuerySchema } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";

/** GET /api/customers/at-risk — clientes em risco, ordenados pelo faturamento mensal em jogo. */
export const GET = apiRoute({ permission: "customers:view" }, async ({ req, user }) => {
  const q = customersQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return customersPage(getDb(), user, { ...q, classe: "em_risco" });
});
