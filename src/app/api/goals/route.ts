import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { salesGoals } from "@/lib/db/schema";
import { goalsForUser } from "@/lib/goals-service";
import { createGoalSchema, goalsQuerySchema } from "@/lib/validation/goals";

/** GET /api/goals?month=AAAA-MM | from&to [&seller_id] */
export const GET = apiRoute({ permission: "goals:view" }, async ({ req, user }) => {
  const q = goalsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return goalsForUser(getDb(), user, { from: q.from, to: q.to, month: q.month, sellerId: q.seller_id });
});

/** POST /api/goals — somente ADMIN */
export const POST = apiRoute({ permission: "goals:manage", rateLimit: { limit: 30, windowMs: 60_000 } }, async ({ req, user }) => {
  const body = createGoalSchema.parse(await req.json());
  const db = getDb();
  const [goal] = await db
    .insert(salesGoals)
    .values({
      sellerId: body.sellerId,
      periodKind: body.periodKind,
      dayMode: body.dayMode,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      targetRevenue: body.targetRevenue === null || body.targetRevenue === undefined ? null : body.targetRevenue.toFixed(2),
      targetOrders: body.targetOrders ?? null,
      targetNewCustomers: body.targetNewCustomers ?? null,
      createdBy: user.id,
    })
    .returning();
  await audit(db, user.id, "goal.create", "sales_goals", goal.id, { ...body });
  return NextResponse.json(goal, { status: 201 });
});
