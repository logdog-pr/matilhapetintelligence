import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { getSetting, setSetting } from "@/lib/settings";

const schema = z.object({
  minMarginPct: z.number().min(0).max(95),
  maxDiscountPct: z.number().min(0).max(90),
  protectedMinStock: z.number().min(0).max(1_000_000),
  minOrderQty: z.number().int().min(1).max(100_000),
  highMarginPct: z.number().min(0).max(99),
  fallingDropPct: z.number().min(1).max(100),
  fallingMinUnits: z.number().min(0).max(1_000_000),
  sellThroughPct: z.number().min(1).max(100),
  excessTargetCoverageDays: z.number().int().min(1).max(1095),
  highMarginLiftPct: z.number().min(0).max(500),
  bundleDiscountPct: z.number().min(0).max(90),
  bundleMinSupport: z.number().int().min(1).max(10_000),
  bundleMinConfidence: z.number().min(0.01).max(1),
});

/** GET /api/settings/promotions */
export const GET = apiRoute({ permission: "promotions:view" }, async () => ({ params: await getSetting(getDb(), "promotions.params") }));

/** PATCH /api/settings/promotions — margem mínima, desconto máximo, estoque protegido, quantidade mínima… (somente ADMIN). */
export const PATCH = apiRoute({ permission: "settings:manage" }, async ({ req, user }) => {
  const db = getDb();
  const next = schema.parse({ ...(await getSetting(db, "promotions.params")), ...(await req.json()) });
  await setSetting(db, "promotions.params", next, user.id);
  await audit(db, user.id, "settings.promotions", "app_settings", "promotions.params", next);
  return { params: next };
});
