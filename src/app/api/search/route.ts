import { and, eq, exists, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { customerSellers, customers, products, sellers } from "@/lib/db/schema";

const query = z.object({ q: z.string().trim().min(2).max(60) });

/**
 * GET /api/search?q= — busca global.
 * VENDEDOR: apenas clientes vinculados a ele; produtos sem custo; sem lista de vendedores.
 */
export const GET = apiRoute({ permission: "search:use", rateLimit: { limit: 60, windowMs: 60_000 } }, async ({ req, user }) => {
  const { q } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const term = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const db = getDb();

  const customerScope =
    user.role === "VENDEDOR"
      ? exists(
          db
            .select({ one: sql`1` })
            .from(customerSellers)
            .where(and(eq(customerSellers.customerId, customers.id), eq(customerSellers.sellerId, user.sellerId!))),
        )
      : undefined;

  const [customerRows, productRows, sellerRows] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.corporateName, tradeName: customers.tradeName, city: customers.city })
      .from(customers)
      .where(and(or(ilike(customers.corporateName, term), ilike(customers.tradeName, term), ilike(customers.cnpj, term)), customerScope))
      .limit(8),
    db
      .select({ id: products.id, name: products.name, sku: products.sku, brand: products.brand })
      .from(products)
      .where(and(eq(products.deletedInSource, false), or(ilike(products.name, term), ilike(products.sku, term), ilike(products.barcode, term))))
      .limit(8),
    can(user, "sellers:view_all")
      ? db.select({ id: sellers.id, name: sellers.name, region: sellers.region }).from(sellers).where(ilike(sellers.name, term)).limit(5)
      : Promise.resolve([]),
  ]);

  return { customers: customerRows, products: productRows, sellers: sellerRows };
});
