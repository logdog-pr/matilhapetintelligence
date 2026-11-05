import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { eachDay, resolvePeriod } from "@/lib/periods";
import {
  getDailySeries,
  getMonthlySeries,
  getOverview,
  getSellerPerformance,
  getTopCategories,
  getTopProducts,
  listRevenueOrders,
  variation,
} from "@/lib/queries/dashboard";
import { createTestDb } from "./support/db";

describe("períodos", () => {
  const today = "2026-11-18";

  it("mês atual compara com os mesmos dias do mês anterior", () => {
    const p = resolvePeriod("mes", today);
    expect([p.start, p.end]).toEqual(["2026-11-01", "2026-11-18"]);
    expect([p.previous.start, p.previous.end]).toEqual(["2026-10-01", "2026-10-18"]);
  });

  it("últimos 7 e 30 dias usam a janela anterior de mesmo tamanho", () => {
    const p7 = resolvePeriod("7d", today);
    expect([p7.start, p7.end, p7.previous.start, p7.previous.end]).toEqual(["2026-11-12", "2026-11-18", "2026-11-05", "2026-11-11"]);
    const p30 = resolvePeriod("30d", today);
    expect(eachDay(p30.start, p30.end)).toHaveLength(30);
    expect(eachDay(p30.previous.start, p30.previous.end)).toHaveLength(30);
  });

  it("mês anterior e virada de ano", () => {
    const p = resolvePeriod("mes_anterior", "2026-01-10");
    expect([p.start, p.end]).toEqual(["2025-12-01", "2025-12-31"]);
    expect([p.previous.start, p.previous.end]).toEqual(["2025-11-01", "2025-11-30"]);
    // 31/03 → mês anterior com 28 dias: comparação limitada ao último dia de fevereiro
    const m = resolvePeriod("mes", "2026-03-31");
    expect(m.previous.end).toBe("2026-02-28");
  });

  it("personalizado inverte datas trocadas e limita a 3 anos; preset inválido vira mês atual", () => {
    const p = resolvePeriod("personalizado", today, { start: "2026-11-10", end: "2026-11-01" });
    expect([p.start, p.end]).toEqual(["2026-11-01", "2026-11-10"]);
    expect([p.previous.start, p.previous.end]).toEqual(["2026-10-22", "2026-10-31"]);
    const big = resolvePeriod("personalizado", today, { start: "2010-01-01", end: "2026-11-18" });
    expect(eachDay(big.start, big.end).length).toBe(1096);
    expect(resolvePeriod("xyz", today).preset).toBe("mes");
  });

  it("variação percentual sem divisão por zero", () => {
    expect(variation(120, 100)).toBe(20);
    expect(variation(50, 0)).toBeNull();
  });
});

describe("consultas do dashboard", () => {
  let db: Database;
  let close: () => Promise<void>;
  let ana: string;
  let bruno: string;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    const [a, b] = await db.insert(t.sellers).values([{ pedidookId: 1, name: "Ana" }, { pedidookId: 2, name: "Bruno" }]).returning();
    ana = a.id;
    bruno = b.id;
    await db.insert(t.products).values([
      { pedidookId: 100, sku: "RA-1", name: "Ração 15kg", category: "Rações", currentStock: "2", minimumStock: "5" },
      { pedidookId: 200, sku: "AR-1", name: "Areia 4kg", category: "Higiene", currentStock: "50", minimumStock: "10" },
    ]);
    const o = (pid: number, seller: string, sellerPid: number, customer: number, date: string, net: string, cost: string | null, extra = {}) => ({
      pedidookId: pid,
      customerPedidookId: customer,
      sellerPedidookId: sellerPid,
      sellerId: seller,
      orderDate: date,
      status: "pedido",
      grossAmount: net,
      discountAmount: "0",
      netAmount: net,
      costAmount: cost,
      ...extra,
    });
    const inserted = await db
      .insert(t.orders)
      .values([
        o(1, ana, 1, 10, "2026-11-02", "1000.00", "600.00"),
        o(2, ana, 1, 11, "2026-11-02", "500.00", null), // sem custo conhecido
        o(3, bruno, 2, 12, "2026-11-05", "2000.00", "1500.00"),
        o(4, ana, 1, 10, "2026-10-03", "800.00", "500.00"), // mês anterior
        o(5, bruno, 2, 13, "2026-03-01", "300.00", "200.00"), // cliente antigo (inativo)
        o(6, ana, 1, 14, "2026-11-03", "9999.00", "1.00", { status: "orcamento" }), // não conta
        o(7, ana, 1, 15, "2026-11-03", "7777.00", "1.00", { deletedInSource: true }), // excluído
      ])
      .returning({ id: t.orders.id, pid: t.orders.pedidookId });
    const id = (pid: number) => inserted.find((r) => r.pid === pid)!.id;
    const item = (orderPid: number, productPid: number, q: string, total: string, deleted = false) => ({
      orderId: id(orderPid),
      productPedidookId: productPid,
      quantity: q,
      unitPrice: "1",
      totalAmount: total,
      deletedInSource: deleted,
    });
    await db.insert(t.orderItems).values([
      item(1, 100, "5", "1000.00"),
      item(2, 200, "10", "500.00"),
      item(3, 100, "8", "1600.00"),
      item(3, 200, "8", "400.00"),
      item(3, 999, "1", "50.00", true), // item excluído não entra
      item(6, 100, "99", "9999.00"), // orçamento não entra
    ]);
  });
  afterAll(async () => close());

  const nov = { start: "2026-11-01", end: "2026-11-18", previous: { start: "2026-10-01", end: "2026-10-18" } };

  it("indicadores gerais com lucro estimado e cobertura de custo", async () => {
    const ov = await getOverview(db, { ...nov, sellerId: null, includeCompanyOnly: true });
    expect(ov.revenue).toBe(3500);
    expect(ov.orders).toBe(3);
    expect(ov.averageTicket).toBeCloseTo(1166.67, 2);
    // lucro só dos pedidos com custo: (1000+2000) − (600+1500) = 900 ; margem 900/3000 = 30%
    expect(ov.grossProfit).toBe(900);
    expect(ov.grossMarginPct).toBe(30);
    expect(ov.costCoveragePct).toBeCloseTo(85.71, 2);
    expect(ov.previous.revenue).toBe(800);
    expect(ov.criticalStock).toBe(1); // ração: 2 ≤ 5
  });

  it("vendedor não recebe estoque crítico e vê só os próprios números", async () => {
    const ov = await getOverview(db, { ...nov, sellerId: ana, includeCompanyOnly: false });
    expect(ov.revenue).toBe(1500);
    expect(ov.criticalStock).toBeNull();
  });

  it("clientes ativos, em risco e inativos pela classificação individual", async () => {
    const all = await getOverview(db, { ...nov, sellerId: null, includeCompanyOnly: true });
    // 10 (out+nov) ativo; 11 e 12 novos; 13 (só março) inativo
    expect([all.activeCustomers, all.atRiskCustomers, all.inactiveCustomers]).toEqual([3, 0, 1]);
    const anaOnly = await getOverview(db, { ...nov, sellerId: ana, includeCompanyOnly: false });
    expect([anaOnly.activeCustomers, anaOnly.inactiveCustomers]).toEqual([2, 0]);
  });

  it("série diária preenche todos os dias e alinha o período anterior", async () => {
    const s = await getDailySeries(db, { ...nov, sellerId: null });
    expect(s).toHaveLength(18);
    expect(s.find((d) => d.date === "2026-11-02")).toMatchObject({ revenue: 1500, orders: 2 });
    expect(s.find((d) => d.date === "2026-11-04")).toMatchObject({ revenue: 0, orders: 0 });
    expect(s[2].previousRevenue).toBe(800); // 03/11 ↔ 03/10
  });

  it("série mensal com ticket médio", async () => {
    const m = await getMonthlySeries(db, { end: "2026-11-18", months: 12 });
    expect(m).toHaveLength(12);
    expect(m.at(-1)).toMatchObject({ month: "2026-11", revenue: 3500, orders: 3 });
    expect(m.at(-2)).toMatchObject({ month: "2026-10", revenue: 800, averageTicket: 800 });
    expect(m[0].averageTicket).toBeNull();
  });

  it("desempenho por vendedor ordenado por faturamento", async () => {
    const perf = await getSellerPerformance(db, nov);
    expect(perf.map((p) => [p.name, p.revenue, p.customers])).toEqual([
      ["Bruno", 2000, 1],
      ["Ana", 1500, 2],
    ]);
    expect(perf[1].previousRevenue).toBe(800);
  });

  it("produtos e categorias mais vendidos ignoram itens excluídos e orçamentos", async () => {
    const top = await getTopProducts(db, { ...nov, sellerId: null });
    expect(top.map((p) => [p.name, p.itemsAmount, p.quantity])).toEqual([
      ["Ração 15kg", 2600, 13],
      ["Areia 4kg", 900, 18],
    ]);
    const cats = await getTopCategories(db, { ...nov, sellerId: null });
    expect(cats.map((c) => c.category)).toEqual(["Rações", "Higiene"]);
  });

  it("lista os pedidos que compõem o faturamento, sem custo para quem não pode ver", async () => {
    const r = await listRevenueOrders(db, { ...nov, sellerId: null, showCost: false });
    expect(r.total).toBe(3);
    expect(r.totalAmount).toBe(3500);
    expect(r.rows.every((x) => x.costAmount === null)).toBe(true);
    const withCost = await listRevenueOrders(db, { ...nov, sellerId: null, showCost: true });
    expect(withCost.rows.some((x) => x.costAmount !== null)).toBe(true);
  });
});
