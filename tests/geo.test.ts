import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { locate } from "@/lib/geo/locate";
import { validCoords } from "@/lib/pedidook/mappers";
import { addDays } from "@/lib/periods";
import { createTestDb } from "./support/db";

describe("localização de clientes", () => {
  it("usa a coordenada do PedidoOK quando existe", () => {
    expect(locate({ latitude: -22.9, longitude: -47.06, city: "Qualquer", state: "SP" })).toEqual({ lat: -22.9, lng: -47.06, precision: "exata" });
  });

  it("cai para o centro da cidade (IBGE), ignorando acentos, caixa e espaços", () => {
    const a = locate({ latitude: null, longitude: null, city: "  SÃO JOÃO DEL-REI ", state: "mg" });
    expect(a?.precision).toBe("cidade");
    expect(a?.lat).toBeCloseTo(-21.13, 1);
    expect(locate({ latitude: null, longitude: null, city: "Campinas", state: "SP" })?.lng).toBeCloseTo(-47.07, 1);
  });

  it("sem cidade reconhecida não inventa posição", () => {
    expect(locate({ latitude: null, longitude: null, city: "Cidade Inexistente", state: "SP" })).toBeNull();
    expect(locate({ latitude: null, longitude: null, city: "Campinas", state: null })).toBeNull();
  });

  it("descarta coordenadas implausíveis do cadastro", () => {
    expect(validCoords(0, 0)).toEqual({ latitude: null, longitude: null });
    expect(validCoords(-47.06, -22.9)).toEqual({ latitude: null, longitude: null }); // trocadas
    expect(validCoords(null, undefined)).toEqual({ latitude: null, longitude: null });
    expect(validCoords(-22.9, -47.06)).toEqual({ latitude: "-22.9000000", longitude: "-47.0600000" });
  });
});

// ---------------------------------------------------------------- rota do mapa

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
const mapRoute = await import("@/app/api/customers/map/route");
const ctx = { params: Promise.resolve({}) };
let ana: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [a, b] = await db.insert(t.sellers).values([{ pedidookId: 1, name: "Ana" }, { pedidookId: 2, name: "Bruno" }]).returning();
  ana = a.id;
  await db.insert(t.customers).values([
    { pedidookId: 1, corporateName: "Com GPS", cnpj: "12345678000199", city: "Campinas", state: "SP", latitude: "-22.9100000", longitude: "-47.0600000" },
    { pedidookId: 2, corporateName: "Só cidade", city: "Curitiba", state: "PR" },
    { pedidookId: 3, corporateName: "Sem cidade" },
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const o = (pid: number, cust: number, seller: string, sp: number) => ({
    pedidookId: pid, customerPedidookId: cust, sellerPedidookId: sp, sellerId: seller, orderDate: addDays(today, -40), status: "pedido",
    grossAmount: "100", discountAmount: "0", netAmount: "100",
  });
  await db.insert(t.orders).values([o(1, 1, ana, 1), o(2, 2, ana, 1), o(3, 3, b.id, 2)]);
  const { resolveForeignKeys } = await import("@/lib/pedidook/resources");
  await resolveForeignKeys(db);
});
afterAll(async () => close());

describe("GET /api/customers/map", () => {
  it("empresa: pontos exatos, por cidade e sem localização; sem CNPJ no payload", async () => {
    session.user = { id: crypto.randomUUID(), name: "G", email: "g@x.com", role: "GESTOR", sellerId: null };
    const res = await mapRoute.GET(new NextRequest("http://localhost/api/customers/map"), ctx);
    const data = await res.json();
    expect([data.total, data.exact, data.byCity, data.missing]).toEqual([3, 1, 1, 1]);
    expect(JSON.stringify(data)).not.toContain("12345678000199");
    expect(data.regions[0].customers).toBe(1);
  });

  it("vendedor vê só a própria carteira no mapa", async () => {
    session.user = { id: crypto.randomUUID(), name: "A", email: "a@x.com", role: "VENDEDOR", sellerId: ana };
    const data = await (await mapRoute.GET(new NextRequest("http://localhost/api/customers/map"), ctx)).json();
    expect(data.points.map((p: { name: string }) => p.name).sort()).toEqual(["Com GPS", "Só cidade"]);
  });
});
