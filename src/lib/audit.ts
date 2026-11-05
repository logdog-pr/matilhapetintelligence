import { auditLogs } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";

/** Registra ação administrativa. Nunca inclua tokens ou senhas em `metadata`. */
export async function audit(
  db: Database,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({ userId, action, entity, entityId: entityId ?? null, metadata: metadata ?? null });
}
