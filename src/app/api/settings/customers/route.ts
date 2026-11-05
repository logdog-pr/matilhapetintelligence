import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { getSetting, setSetting } from "@/lib/settings";

const schema = z
  .object({
    riskFactor: z.number().min(1).max(10),
    inactiveFactor: z.number().min(1).max(20),
    minOrdersForPattern: z.number().int().min(2).max(50),
    generalRiskDays: z.number().int().min(1).max(3650),
    generalInactiveDays: z.number().int().min(1).max(3650),
    minRiskDays: z.number().int().min(1).max(3650),
    minInactiveDays: z.number().int().min(1).max(3650),
    newDays: z.number().int().min(1).max(365),
    recoveredWindowDays: z.number().int().min(1).max(365),
    recurringMinOrders: z.number().int().min(2).max(365),
    recurringWindowDays: z.number().int().min(7).max(3650),
  })
  .refine((p) => p.inactiveFactor > p.riskFactor, { message: "O fator de inativo deve ser maior que o de risco.", path: ["inactiveFactor"] })
  .refine((p) => p.generalInactiveDays > p.generalRiskDays, { message: "O limite geral de inativo deve ser maior que o de risco.", path: ["generalInactiveDays"] });

/** GET /api/settings/customers */
export const GET = apiRoute({ permission: "customers:view" }, async () => ({ params: await getSetting(getDb(), "customers.classification") }));

/** PATCH /api/settings/customers — regras de classificação (somente ADMIN). */
export const PATCH = apiRoute({ permission: "settings:manage" }, async ({ req, user }) => {
  const db = getDb();
  const next = schema.parse({ ...(await getSetting(db, "customers.classification")), ...(await req.json()) });
  await setSetting(db, "customers.classification", next, user.id);
  await audit(db, user.id, "settings.customers", "app_settings", "customers.classification", next);
  return { params: next };
});
