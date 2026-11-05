import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { analyzeStock, DEFAULT_STOCK_PARAMS, type StockInput } from "@/lib/metrics/stock";
import { addDays } from "@/lib/periods";
import { getStockAnalysis, stockReport, stockTotals } from "@/lib/queries/stock";
import { createTestDb } from "./support/db";

const today = "2026-11-18";
const base: StockInput = {
  currentStock: 50,
  minimumStock: 0,
  unitCost: 10,
  sold7: 14,
  sold30: 60,
  sold60: 120,
  sold90: 180,
  soldWindow: 180,
  saleDaysWindow: 40,
  lastSaleDate: "2026-11-17",
  supplierLeadTimeDays: 10,
  historyDays: 365,
  today,
};

describe("fórmulas de reposição", () => {
  it("calcula demanda, cobertura, segurança, ponto de reposição e sugestão (spec §11)", () => {
    const a = analyzeStock(base);
    // 180 vendidos / 90 dias = 2/dia
    expect(a.avgDailyDemand).toBe(2);
    expect(a.coverageDays).toBe(25); // 50 / 2
    expect(a.safetyStock).toBe(14); // 2 × 7
    expect(a.reorderPoint).toBe(34); // 2 × 10 + 14
    expect(a.desiredStock).toBe(48); // 2 × (10 + 7) + 14
    expect(a.suggestedQty).toBe(0); // máx(0, 48 − 50)
    expect(a.status).toBe("ok");
    expect(a.quality).toBe("boa");
    expect(a.explanation[0]).toContain("180 vendidos ÷ 90 dias");
  });

  it("abaixo do ponto de reposição → comprar, com custo estimado", () => {
    const a = analyzeStock({ ...base, currentStock: 20 });
    expect(a.suggestedQty).toBe(28); // 48 − 20
    expect(a.suggestedCost).toBe(280);
    expect(a.status).toBe("comprar");
  });

  it("estoque desejado nunca fica abaixo do mínimo cadastrado", () => {
    const a = analyzeStock({ ...base, currentStock: 20, minimumStock: 100 });
    expect(a.desiredStock).toBe(100);
    expect(a.suggestedQty).toBe(80);
  });

  it("histórico curto: demanda sobre os dias disponíveis e sem sugestão confiável", () => {
    const a = analyzeStock({ ...base, historyDays: 20, soldWindow: 40, currentStock: 5 });
    expect(a.daysAnalyzed).toBe(20);
    expect(a.avgDailyDemand).toBe(2);
    expect(a.quality).toBe("insuficiente");
    expect(a.suggestedQty).toBeNull();
    expect(a.qualityReasons.join(" ")).toContain("20 dia(s) de histórico");
  });

  it("sem histórico mas abaixo do mínimo: repõe só até o mínimo", () => {
    const a = analyzeStock({ ...base, historyDays: 5, soldWindow: 0, saleDaysWindow: 0, currentStock: 3, minimumStock: 10 });
    expect(a.suggestedQty).toBe(7);
  });

  it("prazo do fornecedor não configurado usa o padrão e rebaixa a qualidade", () => {
    const a = analyzeStock({ ...base, supplierLeadTimeDays: null });
    expect(a.leadTimeDays).toBe(DEFAULT_STOCK_PARAMS.defaultLeadTimeDays);
    expect(a.leadTimeIsDefault).toBe(true);
    expect(a.quality).toBe("limitada");
  });

  it("ruptura, parado, excesso e sem giro", () => {
    expect(analyzeStock({ ...base, currentStock: 0 }).status).toBe("ruptura");
    expect(analyzeStock({ ...base, lastSaleDate: "2026-08-01", soldWindow: 0, saleDaysWindow: 0, sold7: 0, sold30: 0, sold60: 0, sold90: 0 }).status).toBe("parado");
    expect(analyzeStock({ ...base, currentStock: 1000 }).status).toBe("excesso"); // 500 dias de cobertura
    const semGiro = analyzeStock({ ...base, soldWindow: 0, saleDaysWindow: 0, lastSaleDate: null, historyDays: 40 });
    expect(semGiro.status).toBe("sem_giro");
    expect(semGiro.coverageDays).toBeNull(); // sem divisão por zero
  });
});

describe("análise de estoque no banco", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    const [sup] = await db.insert(t.suppliers).values({ pedidookId: 1, name: "Fornecedor A", leadTimeDays: 10 }).returning();
    await db.insert(t.products).values([
      { pedidookId: 100, sku: "RA-1", name: "Ração", currentStock: "20", minimumStock: "0", purchaseCost: "10", supplierId: sup.id, supplierPedidookId: 1 },
      { pedidookId: 200, sku: "AR-1", name: "Areia", currentStock: "40", minimumStock: "0", purchaseCost: "4" },
      { pedidookId: 300, sku: "XX-1", name: "Excluído", currentStock: "1", deletedInSource: true },
    ]);
    // 90 dias de pedidos: ração vende 2/dia; um pedido antigo de areia (parada)
    const ordersRows = Array.from({ length: 90 }, (_, i) => ({
      pedidookId: 1000 + i,
      customerPedidookId: 1,
      sellerPedidookId: 1,
      orderDate: addDays(today, -i),
      status: "pedido",
      grossAmount: "20",
      discountAmount: "0",
      netAmount: "20",
    }));
    ordersRows.push({ ...ordersRows[0], pedidookId: 5000, orderDate: "2026-05-01" });
    ordersRows.push({ ...ordersRows[0], pedidookId: 6000, orderDate: today, status: "orcamento" });
    const inserted = await db.insert(t.orders).values(ordersRows).returning({ id: t.orders.id, pid: t.orders.pedidookId });
    const items = inserted.map((o) =>
      o.pid === 5000
        ? { orderId: o.id, productPedidookId: 200, quantity: "3", unitPrice: "1", totalAmount: "3" }
        : { orderId: o.id, productPedidookId: 100, quantity: o.pid === 6000 ? "999" : "2", unitPrice: "10", totalAmount: "20" },
    );
    await db.insert(t.orderItems).values(items);
  });
  afterAll(async () => close());

  it("soma vendas por janela, ignora orçamentos e produtos excluídos", async () => {
    const { rows, history } = await getStockAnalysis(db, { today });
    expect(history.since).toBe("2026-05-01");
    expect(rows.map((r) => r.sku)).toEqual(["AR-1", "RA-1"]);
    const racao = rows.find((r) => r.sku === "RA-1")!;
    expect(racao.sold7).toBe(14);
    expect(racao.sold30).toBe(60);
    expect(racao.sold90).toBe(180);
    expect(racao.avgDailyDemand).toBe(2);
    expect(racao.leadTimeDays).toBe(10);
    expect(racao.suggestedQty).toBe(28);
    expect(racao.status).toBe("comprar");
    expect(racao.supplierName).toBe("Fornecedor A");
  });

  it("relatórios e totais", async () => {
    const { rows } = await getStockAnalysis(db, { today });
    expect(stockReport(rows, "comprar").map((r) => r.sku)).toEqual(["RA-1"]);
    expect(stockReport(rows, "parados").map((r) => r.sku)).toEqual(["AR-1"]);
    expect(stockReport(rows, "investimento").map((r) => r.sku)).toEqual(["RA-1", "AR-1"]); // 200 vs 160
    const tot = stockTotals(rows);
    expect(tot.toBuy).toBe(1);
    expect(tot.replenishmentCost).toBe(280);
    expect(tot.stockValue).toBe(360);
    expect(tot.idleValue).toBe(160);
  });
});
