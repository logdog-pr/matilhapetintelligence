import { apiRoute } from "@/lib/api/handler";
import { aiSettingsSchema, updateAISettings } from "@/lib/ai/chat-service";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";

/** PATCH /api/ai/settings — ADMIN escolhe provedor e modelos. */
export const PATCH = apiRoute({ permission: "ai:manage", rateLimit: { limit: 20, windowMs: 60_000 } }, async ({ req, user }) => {
  const body = aiSettingsSchema.parse(await req.json());
  const db = getDb();
  const result = await updateAISettings(db, user, body);
  await audit(db, user.id, "ai.settings.update", "app_settings", "ai", body);
  return result;
});
