import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createTestDb } from "./support/db";

let db: Database;
let close: () => Promise<void>;
type U = { id: string; name: string; email: string; role: "ADMIN" | "GESTOR" | "VENDEDOR"; sellerId: string | null };
const session = vi.hoisted(() => ({ user: null as null | U }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => session.user }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

// Provedor falso: chama uma ferramenta de verdade e responde com o número que ela trouxe.
const fake = vi.hoisted(() => ({ calls: [] as { system: string; turns: unknown[]; tools: string[] }[] }));
vi.mock("@/lib/ai/providers/claude", () => ({
  claudeProvider: {
    id: "claude",
    label: "Claude (teste)",
    isConfigured: () => true,
    async run(input: {
      system: string;
      turns: unknown[];
      tools: { name: string }[];
      execute: (n: string, i: unknown) => Promise<{ ok: boolean; result: { faturamento?: number } }>;
    }) {
      fake.calls.push({ system: input.system, turns: input.turns, tools: input.tools.map((x) => x.name) });
      const r = await input.execute("get_sales_summary", { periodo: "mes" });
      return {
        text: `Faturamento: ${r.result.faturamento}`,
        toolCalls: [{ name: "get_sales_summary", input: { periodo: "mes" }, ok: r.ok }],
        model: "fake-model",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  },
}));

process.env.DATABASE_URL = "postgres://test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const { AI_TOOLS, executeTool, toolJsonSchema, toolsFor } = await import("@/lib/ai/tools");
const chatRoute = await import("@/app/api/ai/chat/route");
const convRoute = await import("@/app/api/ai/conversations/[id]/route");
const settingsRoute = await import("@/app/api/ai/settings/route");

let admin: U;
let gestor: U;
let ana: U;
let bruno: U;

const post = (url: string, body: unknown, method = "POST") =>
  new NextRequest(new URL(url, "http://localhost"), { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const noParams = { params: Promise.resolve({}) };

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [sa, sb] = await db.insert(t.sellers).values([{ pedidookId: 1, name: "Ana" }, { pedidookId: 2, name: "Bruno" }]).returning();
  const users = await db
    .insert(t.users)
    .values([
      { name: "Admin", email: "a@x.com", role: "ADMIN" },
      { name: "Gestor", email: "g@x.com", role: "GESTOR" },
      { name: "Ana", email: "ana@x.com", role: "VENDEDOR", sellerId: sa.id },
      { name: "Bruno", email: "b@x.com", role: "VENDEDOR", sellerId: sb.id },
    ])
    .returning();
  const toU = (u: (typeof users)[number]): U => ({ id: u.id, name: u.name, email: u.email, role: u.role, sellerId: u.sellerId });
  [admin, gestor, ana, bruno] = users.map(toU);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await db.insert(t.orders).values([
    { pedidookId: 1, customerPedidookId: 1, sellerPedidookId: 1, sellerId: sa.id, orderDate: today, status: "pedido", grossAmount: "100", discountAmount: "0", netAmount: "100", costAmount: "60" },
    { pedidookId: 2, customerPedidookId: 2, sellerPedidookId: 2, sellerId: sb.id, orderDate: today, status: "pedido", grossAmount: "900", discountAmount: "0", netAmount: "900", costAmount: "500" },
  ]);
});
afterAll(async () => close());

const ctxFor = (user: U) => ({ db, user, now: new Date() });

describe("ferramentas da IA", () => {
  it("todas geram JSON Schema de objeto", () => {
    for (const tool of AI_TOOLS) expect(toolJsonSchema(tool as never)).toMatchObject({ type: "object" });
  });

  it("vendedor não recebe ferramentas da empresa", () => {
    const names = toolsFor(ana as never).map((x) => x.name);
    expect(names).toContain("get_sales_summary");
    expect(names).not.toContain("get_seller_performance");
    expect(names).not.toContain("get_stock_recommendations");
    expect(names).not.toContain("get_promotion_opportunities");
    expect(toolsFor(gestor as never).map((x) => x.name)).toContain("get_seller_performance");
  });

  it("vendedor é bloqueado mesmo se o modelo chamar a ferramenta proibida", async () => {
    const r = await executeTool(ctxFor(ana) as never, "get_seller_performance", { periodo: "mes" });
    expect(r.ok).toBe(false);
  });

  it("vendedor só vê o próprio faturamento e sem margem; gestor vê a empresa", async () => {
    const own = await executeTool(ctxFor(ana) as never, "get_sales_summary", { periodo: "mes" });
    expect(own.result).toMatchObject({ faturamento: 100, escopo: "vendedor", margem_bruta_pct: null, lucro_bruto_estimado: null });
    const other = await executeTool(ctxFor(ana) as never, "get_sales_summary", { periodo: "mes", vendedor_id: bruno.sellerId });
    expect(other.ok).toBe(false);
    const company = await executeTool(ctxFor(gestor) as never, "get_sales_summary", { periodo: "mes" });
    expect(company.result).toMatchObject({ faturamento: 1000, escopo: "empresa" });
  });

  it("parâmetros inválidos voltam como erro legível, sem exceção", async () => {
    const r = await executeTool(ctxFor(gestor) as never, "get_sales_summary", { periodo: "semana" });
    expect(r.ok).toBe(false);
    expect(r.result).toMatchObject({ erro: "Parâmetros inválidos." });
  });
});

describe("POST /api/ai/chat", () => {
  it("responde com dados do escopo do usuário e salva o histórico", async () => {
    session.user = ana;
    const res = await chatRoute.POST(post("/api/ai/chat", { message: "Quanto vendi este mês?" }), noParams);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message.content).toBe("Faturamento: 100");
    expect(data.message.metadata.tools[0]).toMatchObject({ name: "get_sales_summary", ok: true });
    expect(fake.calls.at(-1)!.system).toContain("VENDEDOR");
    expect(fake.calls.at(-1)!.tools).not.toContain("get_seller_performance");

    // segunda pergunta na mesma conversa leva o histórico
    await chatRoute.POST(post("/api/ai/chat", { conversationId: data.conversationId, message: "E ontem?" }), noParams);
    expect(fake.calls.at(-1)!.turns).toHaveLength(3);

    const conv = await convRoute.GET(new NextRequest(new URL(`/api/ai/conversations/${data.conversationId}`, "http://localhost")), {
      params: Promise.resolve({ id: data.conversationId }),
    });
    const body = await conv.json();
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);

    // outro usuário não acessa a conversa
    session.user = bruno;
    const denied = await convRoute.GET(new NextRequest(new URL(`/api/ai/conversations/${data.conversationId}`, "http://localhost")), {
      params: Promise.resolve({ id: data.conversationId }),
    });
    expect(denied.status).toBe(404);
    const hijack = await chatRoute.POST(post("/api/ai/chat", { conversationId: data.conversationId, message: "oi" }), noParams);
    expect(hijack.status).toBe(404);
  });

  it("rejeita pergunta vazia", async () => {
    session.user = gestor;
    const res = await chatRoute.POST(post("/api/ai/chat", { message: "   " }), noParams);
    expect(res.status).toBe(400);
  });

  it("só ADMIN troca o provedor", async () => {
    session.user = gestor;
    const denied = await settingsRoute.PATCH(post("/api/ai/settings", { provider: "openai" }, "PATCH"), noParams);
    expect(denied.status).toBe(403);
    session.user = admin;
    const ok = await settingsRoute.PATCH(post("/api/ai/settings", { provider: "openai", models: { openai: "gpt-test" } }, "PATCH"), noParams);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ current: "openai" });
  });
});
