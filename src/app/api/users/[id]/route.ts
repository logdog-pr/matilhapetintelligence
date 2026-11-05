import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["ADMIN", "GESTOR", "VENDEDOR"]).optional(),
  sellerId: z.uuid().nullable().optional(),
  active: z.boolean().optional(),
});

/** PATCH /api/users/:id — papel, vendedor vinculado e ativação (somente ADMIN). */
export const PATCH = apiRoute<{ id: string }>({ permission: "users:manage" }, async ({ req, user, params }) => {
  const id = z.uuid().parse(params.id);
  const input = patchSchema.parse(await req.json());
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) throw new HttpError(404, "Usuário não encontrado.");

  const nextRole = input.role ?? target.role;
  const nextSeller = input.sellerId !== undefined ? input.sellerId : target.sellerId;
  if (nextRole === "VENDEDOR" && !nextSeller) throw new HttpError(400, "Usuário vendedor precisa de um vendedor vinculado.");

  // Nunca deixar o sistema sem administrador ativo.
  const losesAdmin = target.role === "ADMIN" && (nextRole !== "ADMIN" || input.active === false);
  if (losesAdmin) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, "ADMIN"), eq(users.active, true), ne(users.id, id)));
    if (n === 0) throw new HttpError(400, "É necessário manter ao menos um administrador ativo.");
  }

  const [updated] = await db
    .update(users)
    .set({ ...input, sellerId: nextSeller, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id, role: users.role, active: users.active, sellerId: users.sellerId });
  await audit(db, user.id, "user.update", "users", id, input);
  return updated;
});
