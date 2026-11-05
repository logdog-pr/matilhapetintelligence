import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { salesGoals } from "@/lib/db/schema";
import { updateGoalSchema } from "@/lib/validation/goals";

const idSchema = z.uuid();

/** PATCH /api/goals/:id — somente ADMIN */
export const PATCH = apiRoute<{ id: string }>({ permission: "goals:manage" }, async ({ req, user, params }) => {
  const id = idSchema.parse(params.id);
  const body = updateGoalSchema.parse(await req.json());
  const db = getDb();
  const [current] = await db.select().from(salesGoals).where(eq(salesGoals.id, id));
  if (!current) throw new HttpError(404, "Meta não encontrada.");
  const start = body.periodStart ?? current.periodStart;
  const end = body.periodEnd ?? current.periodEnd;
  if (start > end) throw new HttpError(400, "A data inicial deve ser anterior ou igual à final.");

  const { targetRevenue, ...rest } = body;
  const [goal] = await db
    .update(salesGoals)
    .set({
      ...rest,
      ...(targetRevenue !== undefined ? { targetRevenue: targetRevenue === null ? null : targetRevenue.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(salesGoals.id, id))
    .returning();
  await audit(db, user.id, "goal.update", "sales_goals", id, { ...body });
  return goal;
});

/** DELETE /api/goals/:id — somente ADMIN */
export const DELETE = apiRoute<{ id: string }>({ permission: "goals:manage" }, async ({ user, params }) => {
  const id = idSchema.parse(params.id);
  const db = getDb();
  const [goal] = await db.delete(salesGoals).where(eq(salesGoals.id, id)).returning({ id: salesGoals.id });
  if (!goal) throw new HttpError(404, "Meta não encontrada.");
  await audit(db, user.id, "goal.delete", "sales_goals", id);
  return { ok: true };
});
