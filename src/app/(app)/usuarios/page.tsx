import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { sellers, users } from "@/lib/db/schema";
import { configStatus } from "@/lib/env";
import { UsersManager } from "./UsersManager";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const me = await requirePageUser("users:manage");
  const db = getDb();
  const [rows, sellerOptions] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, sellerId: users.sellerId, sellerName: sellers.name })
      .from(users)
      .leftJoin(sellers, eq(sellers.id, users.sellerId))
      .orderBy(asc(users.name)),
    db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.deletedInSource, false)).orderBy(asc(sellers.name)),
  ]);

  return (
    <>
      <PageHeader title="Usuários" description="Papéis: Administrador (acesso total), Gestor (comercial) e Vendedor (somente os próprios dados)." />
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} usuário(s)</CardTitle>
        </CardHeader>
        <UsersManager users={rows} sellers={sellerOptions} meId={me.id} canCreate={!!process.env.SUPABASE_SERVICE_ROLE_KEY && configStatus().auth} />
      </Card>
    </>
  );
}
