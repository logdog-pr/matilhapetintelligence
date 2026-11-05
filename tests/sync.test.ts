import { count, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { PedidookClient } from "@/lib/pedidook/client";
import { LIST_RESOURCE_KEYS } from "@/lib/pedidook/resources";
import { budgetGuard, runCustomerSellers, runDueResources, runListResource } from "@/lib/pedidook/sync";
import { createTestDb } from "./support/db";
import { fakeFetch, fixture, paginate } from "./support/fake-pedidook";

const NOW = new Date("2026-11-04T15:00:00Z");
const opts = { mode: "full" as const, trigger: "test" as const, deadline: Number.MAX_SAFE_INTEGER, now: () => NOW };

/** Responde cada recurso com o exemplo oficial da documentação, paginado. */
function docServer(perPage = 100) {
  return fakeFetch((url) => {
    const p = url.pathname.replace(/^\/v1\//, "").replace(/\/$/, "");
    const assoc = p.match(/^clientes\/(\d+)\/vendedores$/);
    if (assoc) return { body: fixture("clientes_vendedores") };
    if ((LIST_RESOURCE_KEYS as readonly string[]).includes(p)) {
      const f = fixture(p);
      return paginate(p, f[p] as unknown[], perPage, p)(url);
    }
    return undefined;
  });
}

const client = (impl: typeof fetch, extra: Partial<ConstructorParameters<typeof PedidookClient>[0]> = {}) =>
  new PedidookClient({ tokenParceiro: "tp", tokenPedidook: "tk", fetchImpl: impl, maxRetries: 0, sleep: async () => {}, ...extra });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rows = async (db: Database, table: any): Promise<number> => {
  const [{ n }] = await db.select({ n: count() }).from(table);
  return n;
};

let db: Database;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await createTestDb()));
afterEach(async () => close());

describe("importação histórica", () => {
  it("importa todos os recursos documentados e liga as FKs", async () => {
    const srv = docServer();
    const results = await runDueResources(db, client(srv.impl), opts);
    expect(results.every((r) => r.status === "success")).toBe(true);

    expect(await rows(db, t.products)).toBe(4);
    expect(await rows(db, t.sellers)).toBe(1);
    expect(await rows(db, t.orders)).toBe(1);
    expect(await rows(db, t.orderItems)).toBe(2);

    // Associação cliente↔vendedor (1722049 ↔ 5197, ambos presentes nos exemplos)
    const assoc = await db.select().from(t.customerSellers);
    expect(assoc).toHaveLength(1);
    expect(assoc[0].sellerPedidookId).toBe(5197);
    expect(assoc[0].sellerId).not.toBeNull();

    // Snapshot de estoque do dia
    const snaps = await db.select().from(t.stockSnapshots);
    expect(snaps).toHaveLength(4);
    expect(snaps[0].snapshotDate).toBe("2026-11-04");

    // Validação de contagem registrada no log
    const [log] = await db.select().from(t.syncLogs).where(eq(t.syncLogs.resource, "produtos"));
    expect(log.status).toBe("success");
    expect(log.countCheck).toMatchObject({ recordsReadInRun: 4, rowsInDatabase: 4, ok: true });
  });

  it("calcula e preserva totais e custo histórico do pedido", async () => {
    await runListResource(db, client(docServer().impl), "pedidos", opts);
    const [o] = await db.select().from(t.orders);
    // 22 × 78,80 + 2 × 30,88 = 1.795,36 ; o −6% do cabeçalho já está embutido no preco_liquido
    expect(o.netAmount).toBe("1795.36");
    expect(o.grossAmount).toBe("1854.78"); // 22×80,99 + 2×36,50
    expect(o.costAmount).toBe("1364.90"); // 22×60 + 2×22,45
    expect(o.status).toBe("pedido");
    expect(o.situation).toBe("pendente");
    expect(o.customerId).toBeNull(); // cliente 1722157 não está nos exemplos → FK pendente, sem inventar
    const items = await db.select().from(t.orderItems);
    expect(items.map((i) => i.unitCostSnapshot).sort()).toEqual(["22.45", "60.00"]);
  });

  it("percorre todas as páginas via href_proxima_pagina", async () => {
    const srv = docServer(1);
    const r = await runListResource(db, client(srv.impl), "produtos", opts);
    expect(r.status).toBe("success");
    expect(r.recordsRead).toBe(4);
    expect(srv.calls).toHaveLength(4);
    expect(srv.calls[3]).toContain("pagina=4");
    expect(await rows(db, t.products)).toBe(4);
  });

  it("é idempotente: reimportar não duplica registros", async () => {
    const c = client(docServer(2).impl);
    const first = await runListResource(db, c, "produtos", opts);
    const second = await runListResource(db, c, "produtos", opts);
    expect(first.created).toBe(4);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(4);
    expect(await rows(db, t.products)).toBe(4);
  });

  it("retoma da página onde parou após falha", async () => {
    const ok = docServer(1);
    let failOnPage3 = true;
    const flaky = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (failOnPage3 && String(input).includes("pagina=3")) throw new TypeError("fetch failed");
      return ok.impl(input, init);
    }) as typeof fetch;

    const r1 = await runListResource(db, client(flaky), "produtos", opts);
    expect(r1.status).toBe("error");
    const [cur] = await db.select().from(t.syncCursors).where(eq(t.syncCursors.resource, "produtos"));
    expect(cur.lastPage).toBe(2);
    expect(cur.nextPageUrl).toContain("pagina=3");
    expect(cur.sourceWatermark).toBeNull(); // cursor não avança em falha

    failOnPage3 = false;
    ok.calls.length = 0;
    const r2 = await runListResource(db, client(flaky), "produtos", opts);
    expect(r2.status).toBe("success");
    expect(ok.calls[0]).toContain("pagina=3"); // retomou, não recomeçou
    expect(await rows(db, t.products)).toBe(4);
    const logs = await db.select().from(t.syncLogs).where(eq(t.syncLogs.resource, "produtos"));
    expect(logs).toHaveLength(1); // mesma execução
    expect(logs[0].recordsRead).toBe(4);
  });
});

describe("sincronização incremental", () => {
  it("usa alterado_apos com sobreposição e só avança o cursor no sucesso", async () => {
    const srv = docServer();
    await runListResource(db, client(srv.impl), "produtos", opts);
    let [cur] = await db.select().from(t.syncCursors).where(eq(t.syncCursors.resource, "produtos"));
    // maior ultima_alteracao dos exemplos: 2019-04-09T10:49:50.506755
    expect(cur.sourceWatermark).toBe("2019-04-09 10:49:50");

    srv.calls.length = 0;
    await runListResource(db, client(srv.impl), "produtos", { ...opts, mode: "incremental" });
    expect(new URL(srv.calls[0]).searchParams.get("alterado_apos")).toBe("2019-04-09T10:44:50");

    // Falha no incremental: watermark permanece
    const failing = (async () => new Response(JSON.stringify({ erros: [{ codigo: 999, mensagem: "Erro interno" }] }), { status: 500 })) as typeof fetch;
    const r = await runListResource(db, client(failing), "produtos", { ...opts, mode: "incremental" });
    expect(r.status).toBe("error");
    [cur] = await db.select().from(t.syncCursors).where(eq(t.syncCursors.resource, "produtos"));
    expect(cur.sourceWatermark).toBe("2019-04-09 10:49:50");
    expect(cur.lastError).toContain("999");
  });

  it("respeita o intervalo configurado por recurso", async () => {
    const srv = docServer();
    await runDueResources(db, client(srv.impl), { ...opts, only: ["vendedores"] });
    const later = new Date(NOW.getTime() + 10 * 60_000); // 10 min depois; intervalo de vendedores = 60
    const res = await runDueResources(db, client(srv.impl), { ...opts, mode: "incremental", trigger: "cron", now: () => later, only: ["vendedores"] });
    expect(res[0].status).toBe("skipped");
  });
});

describe("controles", () => {
  it("interrompe ao atingir o orçamento diário de requisições", async () => {
    const srv = docServer(1);
    const c = client(srv.impl, { onBeforeRequest: budgetGuard(db, 2, () => NOW) });
    const r = await runListResource(db, c, "produtos", opts);
    expect(r.status).toBe("partial");
    expect(r.message).toMatch(/requisições/);
    expect(srv.calls).toHaveLength(2);
    const [counter] = await db.select().from(t.apiRequestCounters);
    expect(counter.count).toBe(3); // 3ª tentativa bloqueada antes de chamar a API
  });

  it("não executa o mesmo recurso em paralelo", async () => {
    await db.insert(t.syncCursors).values({ resource: "produtos", lockedUntil: new Date(Date.now() + 60_000), status: "running" });
    const r = await runListResource(db, client(docServer().impl), "produtos", opts);
    expect(r.status).toBe("locked");
  });

  it("recusa paginação para fora do domínio oficial", async () => {
    const evil = fakeFetch(() => ({ body: { produtos: [], href_proxima_pagina: "https://evil.example.com/v1/produtos/?pagina=2" } }));
    const r = await runListResource(db, client(evil.impl), "produtos", opts);
    expect(r.status).toBe("error");
    expect(evil.calls).toHaveLength(1);
  });

  it("associações cliente×vendedor só releem clientes alterados", async () => {
    const srv = docServer();
    await runDueResources(db, client(srv.impl), opts);
    srv.calls.length = 0;
    const r = await runCustomerSellers(db, client(srv.impl), { ...opts, mode: "incremental" });
    expect(r.recordsRead).toBe(0);
    expect(srv.calls).toHaveLength(0);
  });
});
