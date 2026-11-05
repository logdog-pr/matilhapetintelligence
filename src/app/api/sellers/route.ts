import { asc, eq } from "drizzle-orm";
import { apiRoute } from "@/lib/api/handler";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";

/** GET /api/sellers — lista de vendedores sincronizados (ADMIN/GESTOR). */
export const GET = apiRoute({ permission: "sellers:view_all" }, async () => ({
  sellers: await getDb()
    .select({ id: sellers.id, pedidookId: sellers.pedidookId, name: sellers.name, region: sellers.region, active: sellers.active })
    .from(sellers)
    .where(eq(sellers.deletedInSource, false))
    .orderBy(asc(sellers.name)),
}));
