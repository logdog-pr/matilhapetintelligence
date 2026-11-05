/**
 * Saúde da integração e "frescor" dos dados (spec §18).
 * Estados: atualizado | parcial | desatualizado | indisponivel.
 * Nunca apresentar dados antigos como se fossem atualizados em tempo real.
 */
import { count, desc } from "drizzle-orm";
import { syncCursors, syncLogs } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { LIST_RESOURCES, RESOURCE_LABELS, RESOURCE_ORDER, type ResourceKey } from "@/lib/pedidook/resources";
import { requestsUsedToday } from "@/lib/pedidook/sync";
import { getSetting } from "@/lib/settings";

export type Freshness = "atualizado" | "parcial" | "desatualizado" | "indisponivel";

export interface ResourceHealth {
  resource: ResourceKey;
  label: string;
  status: string;
  freshness: Freshness;
  lastSuccessfulSync: Date | null;
  nextSyncAt: Date | null;
  intervalMinutes: number;
  rows: number | null;
  lastError: string | null;
  pendingPage: number | null;
}

export function freshnessOf(
  c: { lastSuccessfulSync: Date | null; status: string; nextPageUrl: string | null } | undefined,
  intervalMinutes: number,
  now: Date,
): Freshness {
  if (!c || !c.lastSuccessfulSync) return c?.nextPageUrl || c?.status === "partial" ? "parcial" : "indisponivel";
  if (c.nextPageUrl || c.status === "partial") return "parcial";
  const age = now.getTime() - c.lastSuccessfulSync.getTime();
  // tolerância: 3× o intervalo configurado
  return age <= intervalMinutes * 3 * 60_000 ? "atualizado" : "desatualizado";
}

/** Estado geral = pior estado entre os recursos principais. */
export function overallFreshness(list: Freshness[]): Freshness {
  const rank: Freshness[] = ["indisponivel", "desatualizado", "parcial", "atualizado"];
  return list.reduce<Freshness>((worst, f) => (rank.indexOf(f) < rank.indexOf(worst) ? f : worst), "atualizado");
}

const CORE: ResourceKey[] = ["pedidos", "clientes", "produtos", "vendedores"];

export async function getSyncHealth(db: Database, now = new Date()) {
  const [cursors, intervals, budget, used] = await Promise.all([
    db.select().from(syncCursors),
    getSetting(db, "sync.intervals"),
    getSetting(db, "sync.dailyRequestBudget"),
    requestsUsedToday(db, now),
  ]);
  const byKey = new Map(cursors.map((c) => [c.resource, c]));

  const resources: ResourceHealth[] = await Promise.all(
    RESOURCE_ORDER.map(async (key) => {
      const c = byKey.get(key);
      const intervalMinutes = intervals[key] ?? 60;
      let rows: number | null = null;
      if (key in LIST_RESOURCES) {
        const [r] = await db.select({ n: count() }).from(LIST_RESOURCES[key as keyof typeof LIST_RESOURCES].table);
        rows = r.n;
      }
      return {
        resource: key,
        label: RESOURCE_LABELS[key],
        status: c?.status ?? "idle",
        freshness: freshnessOf(c, intervalMinutes, now),
        lastSuccessfulSync: c?.lastSuccessfulSync ?? null,
        nextSyncAt: c?.lastSuccessfulSync ? new Date(c.lastSuccessfulSync.getTime() + intervalMinutes * 60_000) : null,
        intervalMinutes,
        rows,
        lastError: c?.lastError ?? null,
        pendingPage: c?.nextPageUrl ? (c.lastPage ?? 0) + 1 : null,
      };
    }),
  );

  return {
    overall: overallFreshness(resources.filter((r) => CORE.includes(r.resource)).map((r) => r.freshness)),
    resources,
    requests: { usedToday: used, budget, officialLimit: 20000 },
  };
}

export async function getRecentSyncLogs(db: Database, limit = 30) {
  return db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(limit);
}
