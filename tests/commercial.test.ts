import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { addDays } from "@/lib/periods";
import { classifyCustomers } from "@/lib/queries/customers";
import { createTestDb } from "./support/db";

let db: Database;
let close: () => Promise<void>;
const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; email: string; role: "ADMIN" | "GESTOR" | "VENDEDOR"; sellerId: string | null },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => session.user }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
process.env.DATABASE_URL = "postgres://test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const customersRoute = await import("@/app/api/customers/route");
const atRiskRoute = await import("@/app/api/customers/at-risk/route");
const metricsRoute = await import("@/app/api/customers/[id]/metrics/route");
const historyRoute = await import("@/app/api/customers/[id]/history/route");
const suggestionsRoute = await import("@/app/api/promotions/suggestions/route");
const generateRoute = await import("@/app/api/promotions/generate/route");
const approveRoute = await import("@/app/api/promotions/[id]/approve/route");
const promoSettingsRoute = await import("@/app/api/settings/promotions/route");

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const ago = (n: number) => addDays(today, -n);
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL(url, "http://localhost"), init);
const ctx = { params: Promise.resolve({}) };
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

let ana: string;
let bruno: string;
let gestorId: string;
const cust: Record<string, string> = {};

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [a, b] = await db.insert(t.sellers).values([{ pedidookId: 1, name: "Ana" }, { pedidookId: 2, name: "Bruno" }]).returning();
  ana = a.id;
  bruno = b.id;
  const [g] = await db.insert(t.users).values({ name: "Gestor", email: "g@x.com", role: "GESTOR" }).returning();
  gestorId = g.id;

  const cs = await db
    .insert(t.customers)
    .values([
      { pedidookId: 101, corporateName: "Pet Shop Regular", city: "Campinas", state: "SP" },
      { pedidookId: 102, corporateName: "Agropet Sumido", city: "Sorocaba", state: "SP" },
      { pedidookId: 103, corporateName: "Banho e Tosa Compartilhado", city: "Curitiba", state: "PR" },
    ])
    .returning();
  for (const c of cs) cust[c.corporateName] = c.id;
  await db.insert(t.customerSellers).values({ customerId: cust["Agropet Sumido"], sellerPedidookId: 1, sellerId: ana });

  const [pRacao, pAreia, pPetisco, pParado] = await db
    .insert(t.products)
    .values([
      { pedidookId: 10, sku: "RAC", name: "Ração", currentStock: "200", minimumStock: "10", purchaseCost: "60", salePrice: "100" },
      { pedidookId: 20, sku: "ARE", name: "Areia", currentStock: "100", minimumStock: "5", purchaseCost: "10", salePrice: "20" },
      { pedidookId: 30, sku: "PET", name: "Petisco", currentStock: "100", minimumStock: "0", purchaseCost: "5", salePrice: "10" },
      { pedidookId: 40, sku: "COL", name: "Coleira parada", currentStock: "50", minimumStock: "0", purchaseCost: "30", salePrice: "60" },
    ])
    .returning();
  void pRacao;
  void pAreia;
  void pPetisco;
  void pParado;

  let pid = 1000;
  const order = (customer: number, seller: string, sellerPid: number, date: string) => ({
    pedidookId: pid++,
    customerPedidookId: customer,
    sellerPedidookId: sellerPid,
    sellerId: seller,
    orderDate: date,
    status: "pedido",
    grossAmount: "100",
    discountAmount: "0",
    netAmount: "100",
  });
  const rows = [
    // Regular: compra com Ana a cada 10 dias (recorrente)
    ...[5, 15, 25, 35, 45, 55].map((d) => order(101, ana, 1, ago(d))),
    // Sumido: comprava a cada 10 dias, parou há 40 → inativo (> 25)
    ...[40, 50, 60, 70].map((d) => order(102, ana, 1, ago(d))),
    // Compartilhado: Bruno vende muito; Ana vendeu uma vez há 100 dias
    ...[3, 13, 23, 33].map((d) => order(103, bruno, 2, ago(d))),
    order(103, ana, 1, ago(100)),
  ];
  const inserted = await db.insert(t.orders).values(rows).returning({ id: t.orders.id, cpid: t.orders.customerPedidookId });
  // Itens: ração + areia juntos em quase todos os pedidos do Regular; ração só no Compartilhado
  const items = inserted.flatMap((o, i) =>
    o.cpid === 101
      ? [
          { orderId: o.id, productPedidookId: 10, quantity: "2", unitPrice: "100", totalAmount: "200" },
          { orderId: o.id, productPedidookId: 20, quantity: "1", unitPrice: "20", totalAmount: "20" },
        ]
      : [{ orderId: o.id, productPedidookId: i % 2 ? 10 : 30, quantity: "1", unitPrice: "10", totalAmount: "10" }],
  );
  await db.insert(t.orderItems).values(items);
});
afterAll(async () => close());
beforeEach(() => (session.user = null));

const as = (role: "ADMIN" | "GESTOR" | "VENDEDOR", sellerId: string | null = null) =>
  (session.user = { id: role === "GESTOR" ? gestorId : crypto.randomUUID(), name: role, email: `${role}@x.com`, role, sellerId });

describe("classificação de clientes no banco", () => {
  it("empresa: recorrente, inativo e compartilhado ativo", async () => {
    const rows = await classifyCustomers(db, { asOf: today });
    const by = Object.fromEntries(rows.map((r) => [r.name, r.class]));
    expect(by["Pet Shop Regular"]).toBe("recorrente");
    expect(by["Agropet Sumido"]).toBe("inativo");
    expect(by["Banho e Tosa Compartilhado"]).toBe("recorrente");
  });

  it("vendedor: só os próprios pedidos (compartilhado aparece inativo para Ana)", async () => {
    const rows = await classifyCustomers(db, { asOf: today, sellerId: ana });
    const shared = rows.find((r) => r.name === "Banho e Tosa Compartilhado")!;
    expect(shared.orders).toBe(1);
    expect(shared.totalRevenue).toBe(100);
    expect(shared.class).toBe("inativo");
  });
});

describe("API de clientes", () => {
  it("vendedor vê só a carteira dele e não acessa clientes de outros", async () => {
    as("VENDEDOR", bruno);
    const data = await (await customersRoute.GET(req("/api/customers"), ctx)).json();
    expect(data.rows.map((r: { name: string }) => r.name)).toEqual(["Banho e Tosa Compartilhado"]);
    const res = await metricsRoute.GET(req("/x"), idCtx(cust["Pet Shop Regular"]));
    expect(res.status).toBe(404); // sem compras com Bruno
    expect((await customersRoute.GET(req(`/api/customers?vendedor=${ana}`), ctx)).status).toBe(403);
  });

  it("histórico do vendedor não mostra pedidos de colegas", async () => {
    as("VENDEDOR", ana);
    const h = await (await historyRoute.GET(req("/x"), idCtx(cust["Banho e Tosa Compartilhado"]))).json();
    expect(h.orders).toHaveLength(1);
    expect(h.scopedToSeller).toBe(true);
  });

  it("oportunidades: em risco/inativos com filtros", async () => {
    as("GESTOR");
    const r = await (await customersRoute.GET(req("/api/customers?classe=oportunidades"), ctx)).json();
    expect(r.rows.map((x: { name: string }) => x.name)).toEqual(["Agropet Sumido"]);
    expect(r.counts.inativo).toBe(1);
    const sp = await (await customersRoute.GET(req("/api/customers?uf=PR"), ctx)).json();
    expect(sp.total).toBe(1);
    const risk = await (await atRiskRoute.GET(req("/api/customers/at-risk"), ctx)).json();
    expect(risk.total).toBe(0);
    // filtro por vendedor usa a associação oficial
    const byAna = await (await customersRoute.GET(req(`/api/customers?vendedor=${ana}`), ctx)).json();
    expect(byAna.rows.map((x: { name: string }) => x.name)).toContain("Agropet Sumido");
  });
});

describe("motor de promoções", () => {
  it("vendedor não vê sugestões (custo e margem)", async () => {
    as("VENDEDOR", ana);
    expect((await suggestionsRoute.GET(req("/api/promotions/suggestions"), ctx)).status).toBe(403);
    expect((await generateRoute.POST(req("/api/promotions/generate", { method: "POST" }), ctx)).status).toBe(403);
  });

  it("gera, aprova e não repete decisão recente", async () => {
    as("GESTOR");
    const gen = await (await generateRoute.POST(req("/api/promotions/generate", { method: "POST" }), ctx)).json();
    expect(gen.generated).toBeGreaterThan(0);
    const list = await (await suggestionsRoute.GET(req("/api/promotions/suggestions"), ctx)).json();
    const types = list.suggestions.map((s: { type: string; sku: string }) => `${s.type}:${s.sku}`);
    expect(types).toContain("parado:COL"); // nunca vendida, com estoque
    const parado = list.suggestions.find((s: { sku: string }) => s.sku === "COL");
    expect(parado.suggestedPrice).toBe(48); // 60 − 20%
    expect(parado.estimatedMarginPct).toBe(37.5); // (48 − 30) / 48
    // margem mínima sempre respeitada
    for (const s of list.suggestions) expect(s.estimatedMarginPct).toBeGreaterThanOrEqual(15);

    const ok = await approveRoute.POST(req("/x", { method: "POST", body: "{}" }), idCtx(parado.id));
    expect(ok.status).toBe(200);
    expect((await approveRoute.POST(req("/x", { method: "POST", body: "{}" }), idCtx(parado.id))).status).toBe(409);
    const [row] = await db.select().from(t.promotions).where(eq(t.promotions.id, parado.id));
    expect(row.status).toBe("aprovada");
    expect(row.decidedBy).toBe(gestorId);

    await generateRoute.POST(req("/api/promotions/generate", { method: "POST" }), ctx);
    const again = await (await suggestionsRoute.GET(req("/api/promotions/suggestions"), ctx)).json();
    expect(again.suggestions.some((s: { sku: string; type: string }) => s.sku === "COL" && s.type === "parado")).toBe(false);
  });

  it("parâmetros só pelo administrador", async () => {
    as("GESTOR");
    const res = await promoSettingsRoute.PATCH(req("/x", { method: "PATCH", body: JSON.stringify({ minMarginPct: 20 }) }), ctx);
    expect(res.status).toBe(403);
  });
});
