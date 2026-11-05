/**
 * pnpm sync:full        — importação histórica completa (sem limite de tempo; retomável)
 * pnpm sync:incremental — sincronização incremental de todos os recursos
 * Opcional: --only pedidos,clientes
 */
import { parseArgs } from "node:util";
import { PedidookClient } from "../src/lib/pedidook/client";
import { RESOURCE_ORDER, type ResourceKey } from "../src/lib/pedidook/resources";
import { budgetGuard, runDueResources } from "../src/lib/pedidook/sync";
import { getSetting } from "../src/lib/settings";
import { scriptDb } from "./_db.ts";

const { values } = parseArgs({ options: { mode: { type: "string", default: "incremental" }, only: { type: "string" } } });
const mode = values.mode === "full" ? "full" : "incremental";
const only = values.only?.split(",").map((s) => s.trim()) as ResourceKey[] | undefined;
if (only?.some((k) => !RESOURCE_ORDER.includes(k))) {
  console.error(`Recursos válidos: ${RESOURCE_ORDER.join(", ")}`);
  process.exit(1);
}

const tokenParceiro = process.env.PEDIDOOK_TOKEN_PARCEIRO;
const tokenPedidook = process.env.PEDIDOOK_TOKEN;
if (!tokenParceiro || !tokenPedidook) {
  console.error("Configure PEDIDOOK_TOKEN_PARCEIRO e PEDIDOOK_TOKEN (.env.local).");
  process.exit(1);
}

const { db, pool } = scriptDb();
const client = new PedidookClient({ tokenParceiro, tokenPedidook, onBeforeRequest: budgetGuard(db, await getSetting(db, "sync.dailyRequestBudget")) });

const results = await runDueResources(db, client, { mode, trigger: "manual", deadline: Number.MAX_SAFE_INTEGER, only });
console.table(results.map((r) => ({ recurso: r.resource, status: r.status, lidos: r.recordsRead, novos: r.created, atualizados: r.updated, requisicoes: r.requests, obs: r.message ?? "" })));
console.log(`Requisições nesta execução: ${client.requestsMade}`);
await pool.end();
process.exit(results.some((r) => r.status === "error") ? 1 : 0);
