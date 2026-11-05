import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { sellers, users } from "@/lib/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/** GET /api/users — somente ADMIN */
export const GET = apiRoute({ permission: "users:manage" }, async () => {
  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      sellerId: users.sellerId,
      sellerName: sellers.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(sellers, eq(sellers.id, users.sellerId))
    .orderBy(asc(users.name));
  return { users: rows };
});

const createSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(200),
    password: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.").max(72),
    role: z.enum(["ADMIN", "GESTOR", "VENDEDOR"]),
    sellerId: z.uuid().nullable().optional(),
  })
  .refine((u) => u.role !== "VENDEDOR" || !!u.sellerId, { message: "Vincule o vendedor do PedidoOK.", path: ["sellerId"] });

/** POST /api/users — cria o usuário no Supabase Auth e no Pet Intelligence. */
export const POST = apiRoute({ permission: "users:manage", rateLimit: { limit: 20, windowMs: 60_000 } }, async ({ req, user }) => {
  const input = createSchema.parse(await req.json());
  const db = getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${input.email})`);
  if (exists) throw new HttpError(409, "Já existe um usuário com este e-mail.");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
  if (error || !data.user) throw new HttpError(400, `Supabase: ${error?.message ?? "falha ao criar usuário"}`);

  const [created] = await db
    .insert(users)
    .values({ authUserId: data.user.id, name: input.name, email: input.email, role: input.role, sellerId: input.role === "VENDEDOR" ? input.sellerId : (input.sellerId ?? null) })
    .returning({ id: users.id });
  await audit(db, user.id, "user.create", "users", created.id, { email: input.email, role: input.role });
  return NextResponse.json(created, { status: 201 });
});
