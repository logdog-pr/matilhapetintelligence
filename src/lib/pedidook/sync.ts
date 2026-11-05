/**
 * Motor de sincronização PedidoOK → PostgreSQL.
 *
 * Garantias:
 * - Concorrência: lease por recurso em sync_cursors (uma execução por vez).
 * - Retomável: cada página é gravada numa transação junto com o cursor
 *   (next_page_url / last_page). Se o tempo da função acabar ou ocorrer erro,
 *   a próxima execução continua da página seguinte.
 * - Idempotente: upsert por pedidook_id; reprocessar páginas não duplica.
 * - Cursor incremental (source_watermark) só avança quando a execução termina
 *   com sucesso, e é recuado pela duração da execução + sobreposição configurada.
 * - Orçamento diário de requisições (limite oficial 20.000/dia).
 */
import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import { apiRequestCounters, customerSellers, customers, products, stockSnapshots, syncCursors, syncLogs } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { todayInSaoPaulo } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import {
  PedidookApiError,
  PedidookClient,
  type PageResult,
  RequestBudgetExceededError,
  normalizeSourceTimestamp,
  redact,
  toAlteradoApos,
} from "./client";
import {
  ASSOCIATION_RESOURCE,
  LIST_RESOURCES,
  RESOURCE_ORDER,
  resolveForeignKeys,
  type ListResourceKey,
  type ResourceKey,
} from "./resources";
import { clienteVendedorSchema } from "./schemas";

export type SyncMode = "full" | "incremental";

export interface RunOptions {
  mode: SyncMode;
  trigger: "cron" | "manual" | "test";
  /** Epoch ms: parar de buscar novas páginas depois deste instante. */
  deadline: number;
  now?: () => Date;
}

export interface RunResult {
  resource: ResourceKey;
  status: "success" | "partial" | "error" | "locked" | "skipped";
  recordsRead: number;
  created: number;
  updated: number;
  requests: number;
  message?: string;
}

const LEASE_MINUTES = 10;

// ------------------------------------------------------------------ cursor / lease

async function ensureCursor(db: Database, resource: ResourceKey) {
  await db.insert(syncCursors).values({ resource }).onConflictDoNothing();
}

async function acquireLease(db: Database, resource: ResourceKey) {
  await ensureCursor(db, resource);
  const [row] = await db
    .update(syncCursors)
    .set({ lockedUntil: sql`now() + make_interval(mins => ${LEASE_MINUTES})`, status: "running", updatedAt: new Date() })
    .where(and(eq(syncCursors.resource, resource), or(isNull(syncCursors.lockedUntil), lt(syncCursors.lockedUntil, sql`now()`))))
    .returning();
  return row ?? null;
}

async function releaseLease(db: Database, resource: ResourceKey, patch: Partial<typeof syncCursors.$inferInsert>) {
  await db
    .update(syncCursors)
    .set({ ...patch, lockedUntil: null, updatedAt: new Date() })
    .where(eq(syncCursors.resource, resource));
}

// ------------------------------------------------------------------ orçamento de requisições

export function budgetGuard(db: Database, limit: number, now: () => Date = () => new Date()) {
  return async () => {
    const day = todayInSaoPaulo(now());
    const [row] = await db
      .insert(apiRequestCounters)
      .values({ day, count: 1 })
      .onConflictDoUpdate({
        target: apiRequestCounters.day,
        set: { count: sql`${apiRequestCounters.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: apiRequestCounters.count });
    if (row.count > limit) throw new RequestBudgetExceededError(row.count - 1, limit);
  };
}

export async function requestsUsedToday(db: Database, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ count: apiRequestCounters.count })
    .from(apiRequestCounters)
    .where(eq(apiRequestCounters.day, todayInSaoPaulo(now)));
  return row?.count ?? 0;
}

// ------------------------------------------------------------------ utilidades

function maxTs(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return normalizeSourceTimestamp(a) >= normalizeSourceTimestamp(b) ? a : b;
}

/** Recuo do watermark: duração da execução (min) arredondada para cima. */
function elapsedMinutes(start: Date | null, end: Date) {
  return start ? Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 60000)) : 0;
}

function errorMessage(e: unknown): string {
  if (e instanceof PedidookApiError || e instanceof RequestBudgetExceededError) return e.message;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

async function appendLogError(db: Database, logId: string | null, message: string) {
  if (!logId) return;
  await db
    .update(syncLogs)
    .set({ errors: sql`${syncLogs.errors} || ${JSON.stringify([message])}::jsonb` })
    .where(eq(syncLogs.id, logId));
}

// ------------------------------------------------------------------ recursos de lista

export async function runListResource(
  db: Database,
  client: PedidookClient,
  key: ListResourceKey,
  opts: RunOptions,
): Promise<RunResult> {
  const now = opts.now ?? (() => new Date());
  const def = LIST_RESOURCES[key];
  const result: RunResult = { resource: key, status: "success", recordsRead: 0, created: 0, updated: 0, requests: 0 };
  const requestsBefore = client.requestsMade;

  const cursor = await acquireLease(db, key);
  if (!cursor) return { ...result, status: "locked", message: "Outra execução em andamento." };

  let logId = cursor.runLogId;
  try {
    const overlap = await getSetting(db, "sync.overlapMinutes");
    const resuming = !!cursor.runMode && !!cursor.nextPageUrl && !(opts.mode === "full" && cursor.runMode === "incremental");
    let mode: SyncMode = resuming ? cursor.runMode! : opts.mode;
    if (mode === "incremental" && !cursor.sourceWatermark) mode = "full"; // sem histórico ainda

    let url: string | null;
    let page: number;
    let pending: string | null;
    let read: number;
    let runStartedAt: Date;

    if (resuming && logId) {
      url = cursor.nextPageUrl;
      page = cursor.lastPage ?? 0;
      pending = cursor.pendingWatermark;
      read = cursor.runRecordsRead;
      runStartedAt = cursor.runStartedAt ?? now();
      await db.update(syncLogs).set({ status: "running" }).where(eq(syncLogs.id, logId));
    } else {
      url =
        mode === "full"
          ? PedidookClient.listUrl(def.path)
          : PedidookClient.listUrl(def.path, { alterado_apos: toAlteradoApos(cursor.sourceWatermark!, overlap) });
      page = 0;
      pending = null;
      read = 0;
      runStartedAt = now();
      const [log] = await db
        .insert(syncLogs)
        .values({ resource: key, mode, trigger: opts.trigger, startedAt: runStartedAt })
        .returning({ id: syncLogs.id });
      logId = log.id;
      await db
        .update(syncCursors)
        .set({ runMode: mode, runStartedAt, nextPageUrl: url, lastPage: 0, pendingWatermark: null, runRecordsRead: 0, runLogId: logId, lastError: null })
        .where(eq(syncCursors.resource, key));
    }

    while (url && now().getTime() < opts.deadline) {
      const res = await client.getPage(url, def.listKey);
      const parsed = res.records.map((r, i) => {
        const p = def.schema.safeParse(r);
        if (!p.success) {
          const id = (r as { id?: unknown })?.id ?? `#${i}`;
          throw new Error(`Registro ${String(id)} de ${def.label} fora do formato documentado: ${p.error.issues[0]?.path.join(".")} ${p.error.issues[0]?.message}`);
        }
        return p.data as { ultima_alteracao: string };
      });
      for (const r of parsed) pending = maxTs(pending, r.ultima_alteracao);
      page++;
      read += parsed.length;
      const nextUrl = res.nextPageUrl;
      if (nextUrl) PedidookClient.assertAllowedUrl(nextUrl);

      const counts = await db.transaction(async (tx) => {
        const c = parsed.length ? await def.upsert(tx, parsed) : { created: 0, updated: 0 };
        await tx
          .update(syncCursors)
          .set({ nextPageUrl: nextUrl, lastPage: page, pendingWatermark: pending, runRecordsRead: read, updatedAt: new Date() })
          .where(eq(syncCursors.resource, key));
        await tx
          .update(syncLogs)
          .set({
            recordsRead: sql`${syncLogs.recordsRead} + ${parsed.length}`,
            recordsCreated: sql`${syncLogs.recordsCreated} + ${c.created}`,
            recordsUpdated: sql`${syncLogs.recordsUpdated} + ${c.updated}`,
          })
          .where(eq(syncLogs.id, logId!));
        return c;
      });
      result.recordsRead += parsed.length;
      result.created += counts.created;
      result.updated += counts.updated;
      url = nextUrl;
    }

    result.requests = client.requestsMade - requestsBefore;
    await db.update(syncLogs).set({ requestsMade: sql`${syncLogs.requestsMade} + ${result.requests}` }).where(eq(syncLogs.id, logId!));

    if (url) {
      // Tempo esgotado: execução parcial, será retomada.
      await releaseLease(db, key, { status: "partial" });
      await db.update(syncLogs).set({ status: "partial" }).where(eq(syncLogs.id, logId!));
      return { ...result, status: "partial", message: `Parou na página ${page}; será retomada.` };
    }

    // Concluída
    await resolveForeignKeys(db);
    if (key === "produtos") await takeStockSnapshot(db, now());

    let countCheck: Record<string, unknown> | null = null;
    if (mode === "full") {
      const [{ total }] = await db.select({ total: count() }).from(def.table);
      countCheck = { recordsReadInRun: read, rowsInDatabase: total, ok: total >= read || read === 0 };
    }

    const finishedAt = now();
    const watermark = maxTs(cursor.sourceWatermark, pending);
    await releaseLease(db, key, {
      status: "success",
      lastSuccessfulSync: finishedAt,
      sourceWatermark: watermark ? toAlteradoApos(watermark, elapsedMinutes(runStartedAt, finishedAt)) : null,
      runMode: null,
      runStartedAt: null,
      nextPageUrl: null,
      lastPage: null,
      pendingWatermark: null,
      runRecordsRead: 0,
      runLogId: null,
      lastError: null,
    });
    await db.update(syncLogs).set({ status: "success", finishedAt, countCheck }).where(eq(syncLogs.id, logId!));
    return result;
  } catch (e) {
    const message = errorMessage(e);
    result.requests = client.requestsMade - requestsBefore;
    const budget = e instanceof RequestBudgetExceededError || (e instanceof PedidookApiError && e.isRateLimited);
    // Mantém next_page_url para retomar; o watermark NÃO avança.
    await releaseLease(db, key, { status: budget ? "partial" : "error", lastError: message });
    if (logId) {
      await appendLogError(db, logId, message);
      await db
        .update(syncLogs)
        .set({ status: budget ? "partial" : "error", requestsMade: sql`${syncLogs.requestsMade} + ${result.requests}` })
        .where(eq(syncLogs.id, logId));
    }
    return { ...result, status: budget ? "partial" : "error", message };
  }
}

/** Snapshot diário do estoque atual (a API não fornece histórico de movimentações). */
export async function takeStockSnapshot(db: Database, at: Date) {
  const day = todayInSaoPaulo(at);
  await db.execute(sql`
    insert into ${stockSnapshots} (product_id, quantity, snapshot_date, source)
    select id, current_stock, ${day}::date, 'pedidook_sync' from ${products} where deleted_in_source = false
    on conflict (product_id, snapshot_date) do update set quantity = excluded.quantity`);
}

// ------------------------------------------------------------------ associações cliente × vendedor

export async function runCustomerSellers(db: Database, client: PedidookClient, opts: RunOptions): Promise<RunResult> {
  const now = opts.now ?? (() => new Date());
  const key = ASSOCIATION_RESOURCE;
  const result: RunResult = { resource: key, status: "success", recordsRead: 0, created: 0, updated: 0, requests: 0 };
  const requestsBefore = client.requestsMade;
  const cursor = await acquireLease(db, key);
  if (!cursor) return { ...result, status: "locked", message: "Outra execução em andamento." };

  const [log] = await db.insert(syncLogs).values({ resource: key, mode: opts.mode, trigger: opts.trigger }).returning({ id: syncLogs.id });
  try {
    const perRun = await getSetting(db, "sync.customerSellersPerRun");
    const refreshDays = await getSetting(db, "sync.customerSellersRefreshDays");
    const stale = sql`(${customers.sellersSyncedAt} is null
      or ${customers.sellersSyncedVersion} is distinct from ${customers.pedidookUpdatedAt}
      or ${customers.sellersSyncedAt} < now() - make_interval(days => ${refreshDays}))`;

    const pending = await db
      .select({ id: customers.id, pedidookId: customers.pedidookId, version: customers.pedidookUpdatedAt })
      .from(customers)
      .where(and(eq(customers.deletedInSource, false), stale))
      .orderBy(sql`${customers.sellersSyncedAt} asc nulls first`, asc(customers.pedidookId))
      .limit(perRun);

    for (const c of pending) {
      if (now().getTime() >= opts.deadline) break;
      const sellerIds = new Set<number>();
      let url: string | null = PedidookClient.listUrl(`clientes/${c.pedidookId}/vendedores`);
      while (url) {
        const res: PageResult = await client.getPage(url, "vendedores");
        for (const r of res.records) {
          const v = clienteVendedorSchema.safeParse(r);
          if (v.success && !v.data.excluido) sellerIds.add(v.data.id);
        }
        url = res.nextPageUrl;
      }
      await db.transaction(async (tx) => {
        await tx.delete(customerSellers).where(eq(customerSellers.customerId, c.id));
        if (sellerIds.size > 0) {
          await tx.insert(customerSellers).values([...sellerIds].map((sid) => ({ customerId: c.id, sellerPedidookId: sid })));
        }
        await tx
          .update(customers)
          .set({ sellersSyncedAt: now(), sellersSyncedVersion: c.version })
          .where(eq(customers.id, c.id));
      });
      result.recordsRead++;
      result.updated++;
    }

    await resolveForeignKeys(db);
    const [{ remaining }] = await db
      .select({ remaining: count() })
      .from(customers)
      .where(and(eq(customers.deletedInSource, false), stale));
    result.requests = client.requestsMade - requestsBefore;
    const status = remaining > 0 ? "partial" : "success";
    await releaseLease(db, key, {
      status,
      ...(status === "success" ? { lastSuccessfulSync: now() } : {}),
      lastError: null,
    });
    await db
      .update(syncLogs)
      .set({ status, finishedAt: now(), recordsRead: result.recordsRead, recordsUpdated: result.updated, requestsMade: result.requests })
      .where(eq(syncLogs.id, log.id));
    return { ...result, status, message: remaining > 0 ? `${remaining} clientes aguardando leitura.` : undefined };
  } catch (e) {
    const message = errorMessage(e);
    result.requests = client.requestsMade - requestsBefore;
    const budget = e instanceof RequestBudgetExceededError || (e instanceof PedidookApiError && e.isRateLimited);
    await releaseLease(db, key, { status: budget ? "partial" : "error", lastError: message });
    await appendLogError(db, log.id, message);
    await db
      .update(syncLogs)
      .set({ status: budget ? "partial" : "error", finishedAt: now(), recordsRead: result.recordsRead, requestsMade: result.requests })
      .where(eq(syncLogs.id, log.id));
    return { ...result, status: budget ? "partial" : "error", message };
  }
}

// ------------------------------------------------------------------ orquestração

export async function runResource(db: Database, client: PedidookClient, key: ResourceKey, opts: RunOptions) {
  return key === ASSOCIATION_RESOURCE ? runCustomerSellers(db, client, opts) : runListResource(db, client, key, opts);
}

/**
 * Executa os recursos "vencidos" (pelo intervalo configurado) ou com execução
 * pendente, na ordem de dependência, até o prazo.
 * Em modo full, roda todos (importação histórica), retomando onde parou.
 */
export async function runDueResources(
  db: Database,
  client: PedidookClient,
  opts: RunOptions & { only?: ResourceKey[] },
): Promise<RunResult[]> {
  const now = opts.now ?? (() => new Date());
  const intervals = await getSetting(db, "sync.intervals");
  const cursors = await db.select().from(syncCursors);
  const byKey = new Map(cursors.map((c) => [c.resource, c]));
  const results: RunResult[] = [];

  for (const key of opts.only ?? RESOURCE_ORDER) {
    if (now().getTime() >= opts.deadline) {
      results.push({ resource: key, status: "skipped", recordsRead: 0, created: 0, updated: 0, requests: 0, message: "Sem tempo restante nesta execução." });
      continue;
    }
    const c = byKey.get(key);
    const hasPending = !!c?.nextPageUrl || c?.status === "partial" || c?.status === "error";
    const minutes = intervals[key] ?? 60;
    const due =
      opts.mode === "full" ||
      opts.trigger === "manual" ||
      hasPending ||
      !c?.lastSuccessfulSync ||
      now().getTime() - c.lastSuccessfulSync.getTime() >= minutes * 60_000;
    if (!due) {
      results.push({ resource: key, status: "skipped", recordsRead: 0, created: 0, updated: 0, requests: 0, message: "Ainda dentro do intervalo." });
      continue;
    }
    const r = await runResource(db, client, key, opts);
    results.push(r);
    // Limite diário atingido: não adianta continuar com outros recursos.
    if (r.status === "partial" && r.message?.includes("requisições")) break;
  }
  return results;
}

export { redact };
