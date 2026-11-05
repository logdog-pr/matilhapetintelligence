import { apiRoute } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { getSetting, setSetting } from "@/lib/settings";
import { stockParamsSchema } from "@/lib/stock-service";

/** GET /api/settings/stock — parâmetros de reposição. */
export const GET = apiRoute({ permission: "stock:view" }, async () => ({ params: await getSetting(getDb(), "stock.params") }));

/** PATCH /api/settings/stock — altera os parâmetros (somente ADMIN). */
export const PATCH = apiRoute({ permission: "stock:manage" }, async ({ req, user }) => {
  const db = getDb();
  const current = await getSetting(db, "stock.params");
  const next = stockParamsSchema.parse({ ...current, ...(await req.json()) });
  await setSetting(db, "stock.params", next, user.id);
  await audit(db, user.id, "settings.stock", "app_settings", "stock.params", next);
  return { params: next };
});
