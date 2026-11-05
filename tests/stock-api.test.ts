import { eq } from "drizzle-orm";
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

const stockRoute = await import("@/app/api/products/stock/route");
const replenishmentRoute = await import("@/app/api/products/replenishment/route");
const perfRoute = await import("@/app/api/products/[id]/performance/route");
const supplierRoute = await import("@/app/api/suppliers/[id]/route");
const settingsRoute = await import("@/app/api/settings/stock/route");

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL(url, "http://localhost"), init);
const ctx = { params: Promise.resolve({}) };
let supplierId: string;
let productId: string;
let adminId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [s] = await db.insert(t.suppliers).values({ pedidookId: 1, name: "Fornecedor A" }).returning();
  supplierId = s.id;
  const [p] = await db
    .insert(t.products)
    .values({ pedidookId: 10, sku: "SKU-1", name: "Ração", currentStock: "2", minimumStock: "10", purchaseCost: "5", supplierId: s.id })
    .returning();
  productId = p.id;
  const [admin] = await db.insert(t.users).values({ name: "Admin", email: "admin@x.com", role: "ADMIN" }).returning();
  adminId = admin.id;
});
afterAll(async () => close());
beforeEach(() => (session.user = null));

const as = (role: "ADMIN" | "GESTOR" | "VENDEDOR") =>
  (session.user = { id: role === "ADMIN" ? adminId : crypto.randomUUID(), name: role, email: `${role}@x.com`, role, sellerId: role === "VENDEDOR" ? crypto.randomUUID() : null });

describe("API de estoque", () => {
  it("vendedor não acessa o módulo (custos de aquisição)", async () => {
    as("VENDEDOR");
    expect((await stockRoute.GET(req("/api/products/stock"), ctx)).status).toBe(403);
    expect((await perfRoute.GET(req(`/api/products/${productId}/performance`), { params: Promise.resolve({ id: productId }) })).status).toBe(403);
  });

  it("gestor consulta; sem histórico, repõe só até o mínimo cadastrado", async () => {
    as("GESTOR");
    const data = await (await replenishmentRoute.GET(req("/api/products/replenishment"), ctx)).json();
    expect(data.report).toBe("comprar");
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].suggestedQty).toBe(8); // mínimo 10 − estoque 2
    expect(data.rows[0].quality).toBe("insuficiente");
    const perf = await (await perfRoute.GET(req(`/api/products/${productId}/performance`), { params: Promise.resolve({ id: productId }) })).json();
    expect(perf.daily).toHaveLength(90);
    expect(perf.product.explanation.length).toBeGreaterThan(3);
  });

  it("somente administrador altera prazo e parâmetros, com validação", async () => {
    const body = JSON.stringify({ leadTimeDays: 15 });
    const call = () => supplierRoute.PATCH(req(`/api/suppliers/${supplierId}`, { method: "PATCH", body }), { params: Promise.resolve({ id: supplierId }) });
    as("GESTOR");
    expect((await call()).status).toBe(403);
    as("ADMIN");
    expect((await call()).status).toBe(200);
    const [s] = await db.select().from(t.suppliers).where(eq(t.suppliers.id, supplierId));
    expect(s.leadTimeDays).toBe(15);

    const bad = await settingsRoute.PATCH(req("/api/settings/stock", { method: "PATCH", body: JSON.stringify({ windowDays: 2 }) }), ctx);
    expect(bad.status).toBe(400);
    const ok = await (await settingsRoute.PATCH(req("/api/settings/stock", { method: "PATCH", body: JSON.stringify({ safetyDays: 10 }) }), ctx)).json();
    expect(ok.params.safetyDays).toBe(10);
    expect(ok.params.windowDays).toBe(90); // demais mantidos
  });
});
