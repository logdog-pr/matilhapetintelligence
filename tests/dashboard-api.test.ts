import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
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

const overviewRoute = await import("@/app/api/dashboard/overview/route");
const performanceRoute = await import("@/app/api/dashboard/performance/route");
const salesRoute = await import("@/app/api/dashboard/sales/route");
const ordersRoute = await import("@/app/api/dashboard/orders/route");

const ctx = { params: Promise.resolve({}) };
const get = (url: string) => new NextRequest(new URL(url, "http://localhost"));
let ana: string;
let bruno: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [a, b] = await db.insert(t.sellers).values([{ pedidookId: 1, name: "Ana" }, { pedidookId: 2, name: "Bruno" }]).returning();
  ana = a.id;
  bruno = b.id;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await db.insert(t.orders).values([
    { pedidookId: 1, customerPedidookId: 1, sellerPedidookId: 1, sellerId: ana, orderDate: today, status: "pedido", grossAmount: "100", discountAmount: "0", netAmount: "100", costAmount: "60" },
    { pedidookId: 2, customerPedidookId: 2, sellerPedidookId: 2, sellerId: bruno, orderDate: today, status: "pedido", grossAmount: "900", discountAmount: "0", netAmount: "900", costAmount: "500" },
  ]);
});
afterAll(async () => close());
beforeEach(() => (session.user = null));

const as = (role: "ADMIN" | "GESTOR" | "VENDEDOR", sellerId: string | null = null) =>
  (session.user = { id: crypto.randomUUID(), name: role, email: `${role}@x.com`, role, sellerId });

describe("API do dashboard", () => {
  it("exige login", async () => {
    expect((await overviewRoute.GET(get("/api/dashboard/overview"), ctx)).status).toBe(401);
  });

  it("gestor vê a empresa, margem e estoque", async () => {
    as("GESTOR");
    const { data } = await (await overviewRoute.GET(get("/api/dashboard/overview?p=hoje"), ctx)).json();
    expect(data.revenue).toBe(1000);
    expect(data.grossProfit).toBe(440);
    expect(data.criticalStock).toBe(0);
  });

  it("vendedor vê só o próprio faturamento, sem margem nem estoque", async () => {
    as("VENDEDOR", ana);
    const { data, sellerId } = await (await overviewRoute.GET(get("/api/dashboard/overview?p=hoje"), ctx)).json();
    expect(sellerId).toBe(ana);
    expect(data.revenue).toBe(100);
    expect(data.grossProfit).toBeNull();
    expect(data.grossMarginPct).toBeNull();
    expect(data.criticalStock).toBeNull();
  });

  it("vendedor pedindo outro vendedor → 403", async () => {
    as("VENDEDOR", ana);
    expect((await overviewRoute.GET(get(`/api/dashboard/overview?vendedor=${bruno}`), ctx)).status).toBe(403);
    expect((await salesRoute.GET(get(`/api/dashboard/sales?vendedor=${bruno}`), ctx)).status).toBe(403);
  });

  it("ranking de vendedores não é entregue ao vendedor", async () => {
    as("VENDEDOR", ana);
    const v = await (await performanceRoute.GET(get("/api/dashboard/performance?p=hoje"), ctx)).json();
    expect(v.data).toEqual([]);
    as("ADMIN");
    const a = await (await performanceRoute.GET(get("/api/dashboard/performance?p=hoje"), ctx)).json();
    expect(a.data.map((s: { name: string }) => s.name)).toEqual(["Bruno", "Ana"]);
  });

  it("pedidos do vendedor sem custo; parâmetros inválidos → 400", async () => {
    as("VENDEDOR", ana);
    const r = await (await ordersRoute.GET(get("/api/dashboard/orders?p=hoje"), ctx)).json();
    expect(r.data.total).toBe(1);
    expect(r.data.rows[0].costAmount).toBeNull();
    expect((await ordersRoute.GET(get("/api/dashboard/orders?p=semana-que-vem"), ctx)).status).toBe(400);
  });
});
