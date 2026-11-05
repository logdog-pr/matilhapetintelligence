import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { customerDetail } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";

/** GET /api/customers/:id/history — pedidos e produtos que o cliente costuma comprar (vendedor: só os próprios pedidos). */
export const GET = apiRoute<{ id: string }>({ permission: "customers:view" }, async ({ user, params }) => {
  const d = await customerDetail(getDb(), user, z.uuid().parse(params.id));
  return { orders: d.orders, products: d.products, monthly: d.monthly, scopedToSeller: d.scopedToSeller };
});
