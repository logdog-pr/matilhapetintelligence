import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { customerDetail } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";

/** GET /api/customers/:id/metrics — classificação, intervalo médio, ticket e faturamento acumulado. */
export const GET = apiRoute<{ id: string }>({ permission: "customers:view" }, async ({ user, params }) => {
  const d = await customerDetail(getDb(), user, z.uuid().parse(params.id));
  return { customer: d.customer, asOf: d.today };
});
