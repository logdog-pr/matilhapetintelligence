import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { configStatus } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { can, type Permission, type Principal, type Role } from "./rbac";

export interface SessionUser extends Principal {
  name: string;
  email: string;
  role: Role;
}

/** Usuário autenticado e ativo no Pet Intelligence, ou null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cfg = configStatus();
  if (!cfg.auth || !cfg.database) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [row] = await getDb()
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, sellerId: users.sellerId })
    .from(users)
    .where(and(eq(users.authUserId, user.id), eq(users.active, true)))
    .limit(1);
  return row ?? null;
});

/** Guarda de página: redireciona se não autenticado ou sem permissão. */
export async function requirePageUser(permission?: Permission): Promise<SessionUser> {
  const cfg = configStatus();
  if (!cfg.auth || !cfg.database) redirect("/configuracao");
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=sem-acesso");
  if (permission && !can(user, permission)) redirect("/?erro=permissao");
  return user;
}
