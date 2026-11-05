import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { can, HttpError, scopeSellerId } from "@/lib/auth/rbac";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createTestDb } from "./support/db";

// ---- sessão e banco simulados
let db: Database;
let close: () => Promise<void>;
const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string; email: string; role: "ADMIN" | "GESTOR" | "VENDEDOR"; sellerId: string | null } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => session.user }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

process.env.DATABASE_URL = "postgres://test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const goalsRoute = await import("@/app/api/goals/route");
const syncRoute = await import("@/app/api/integrations/pedidook/sync/route");
const usersRoute = await import("@/app/api/users/route");

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL(url, "http://localhost"), init);
const ctx = { params: Promise.resolve({}) };

let sellerA: string;
let sellerB: string;
let adminId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [a, b] = await db
    .insert(t.sellers)
    .values([
      { pedidookId: 1, name: "Ana" },
      { pedidookId: 2, name: "Bruno" },
    ])
    .returning();
  sellerA = a.id;
  sellerB = b.id;
  const [admin] = await db.insert(t.users).values({ name: "Admin", email: "admin@x.com", role: "ADMIN" }).returning();
  adminId = admin.id;
  const goal = (sellerId: string | null, target: string) => ({
    sellerId,
    periodKind: "MENSAL" as const,
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    targetRevenue: target,
  });
  await db.insert(t.salesGoals).values([goal(null, "100000"), goal(sellerA, "40000"), goal(sellerB, "60000")]);
  await db.insert(t.orders).values([
    { pedidookId: 10, customerPedidookId: 1, sellerPedidookId: 1, sellerId: sellerA, orderDate: "2026-11-03", status: "pedido", grossAmount: "1000", discountAmount: "0", netAmount: "1000" },
    { pedidookId: 11, customerPedidookId: 2, sellerPedidookId: 2, sellerId: sellerB, orderDate: "2026-11-03", status: "pedido", grossAmount: "5000", discountAmount: "0", netAmount: "5000" },
    // não contam: orçamento e pedido excluído
    { pedidookId: 12, customerPedidookId: 1, sellerPedidookId: 1, sellerId: sellerA, orderDate: "2026-11-04", status: "orcamento", grossAmount: "9000", discountAmount: "0", netAmount: "9000" },
    { pedidookId: 13, customerPedidookId: 1, sellerPedidookId: 1, sellerId: sellerA, orderDate: "2026-11-04", status: "pedido", grossAmount: "7000", discountAmount: "0", netAmount: "7000", deletedInSource: true },
  ]);
});
afterAll(async () => close());
beforeEach(() => (session.user = null));

const as = (role: "ADMIN" | "GESTOR" | "VENDEDOR", sellerId: string | null = null) =>
  (session.user = { id: role === "ADMIN" ? adminId : crypto.randomUUID(), name: role, email: `${role}@x.com`, role, sellerId });

describe("regras de permissão", () => {
  it("vendedor não acessa integração, usuários nem dados da empresa", () => {
    const v = { role: "VENDEDOR" as const };
    expect(can(v, "integration:view")).toBe(false);
    expect(can(v, "users:manage")).toBe(false);
    expect(can(v, "dashboard:company")).toBe(false);
    expect(can(v, "goals:manage")).toBe(false);
    expect(can({ role: "GESTOR" }, "integration:manage")).toBe(false);
    expect(can({ role: "GESTOR" }, "users:manage")).toBe(false);
  });

  it("escopo de vendedor é forçado no backend", () => {
    const v = { id: "u", role: "VENDEDOR" as const, sellerId: "s1" };
    expect(scopeSellerId(v, undefined)).toBe("s1");
    expect(() => scopeSellerId(v, "s2")).toThrow(HttpError);
    expect(() => scopeSellerId({ ...v, sellerId: null }, undefined)).toThrow(HttpError);
    expect(scopeSellerId({ id: "g", role: "GESTOR", sellerId: null }, "s2")).toBe("s2");
  });
});

describe("rotas protegidas", () => {
  it("sem sessão → 401", async () => {
    const res = await goalsRoute.GET(req("/api/goals?month=2026-11"), ctx);
    expect(res.status).toBe(401);
  });

  it("vendedor vê só a própria meta, com faturamento correto", async () => {
    as("VENDEDOR", sellerA);
    const res = await goalsRoute.GET(req("/api/goals?month=2026-11"), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.goals).toHaveLength(1);
    expect(data.goals[0].sellerId).toBe(sellerA);
    // orçamento e pedido excluído não entram
    expect(data.goals[0].revenue.realized).toBe(1000);
    expect(data.goals[0].revenue.percent).toBe(2.5);
  });

  it("vendedor pedindo dados de outro vendedor → 403", async () => {
    as("VENDEDOR", sellerA);
    const res = await goalsRoute.GET(req(`/api/goals?month=2026-11&seller_id=${sellerB}`), ctx);
    expect(res.status).toBe(403);
  });

  it("gestor vê empresa e todos os vendedores", async () => {
    as("GESTOR");
    const data = await (await goalsRoute.GET(req("/api/goals?month=2026-11"), ctx)).json();
    expect(data.goals).toHaveLength(3);
    const company = data.goals.find((g: { sellerId: string | null }) => g.sellerId === null);
    expect(company.revenue.realized).toBe(6000);
  });

  it("somente administrador cria metas", async () => {
    const body = JSON.stringify({ sellerId: null, periodKind: "MENSAL", periodStart: "2026-12-01", periodEnd: "2026-12-31", targetRevenue: 1000 });
    for (const role of ["VENDEDOR", "GESTOR"] as const) {
      as(role, role === "VENDEDOR" ? sellerA : null);
      const res = await goalsRoute.POST(req("/api/goals", { method: "POST", body }), ctx);
      expect(res.status).toBe(403);
    }
    as("ADMIN");
    const res = await goalsRoute.POST(req("/api/goals", { method: "POST", body }), ctx);
    expect(res.status).toBe(201);
  });

  it("valida a meta (datas e alvo)", async () => {
    as("ADMIN");
    const bad = JSON.stringify({ sellerId: null, periodKind: "MENSAL", periodStart: "2026-12-31", periodEnd: "2026-12-01" });
    const res = await goalsRoute.POST(req("/api/goals", { method: "POST", body: bad }), ctx);
    expect(res.status).toBe(400);
  });

  it("gestor e vendedor não disparam sincronização nem gerenciam usuários", async () => {
    for (const role of ["VENDEDOR", "GESTOR"] as const) {
      as(role, role === "VENDEDOR" ? sellerA : null);
      expect((await syncRoute.POST(req("/api/integrations/pedidook/sync", { method: "POST", body: "{}" }), ctx)).status).toBe(403);
      expect((await usersRoute.GET(req("/api/users"), ctx)).status).toBe(403);
    }
  });
});
