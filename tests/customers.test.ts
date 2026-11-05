import { describe, expect, it } from "vitest";
import { classifyCustomer, DEFAULT_CLASSIFICATION_PARAMS as P } from "@/lib/metrics/customers";
import { addDays } from "@/lib/periods";

const asOf = "2026-11-18";
/** Pedidos a cada `every` dias, terminando `lastAgo` dias antes de asOf. */
const series = (n: number, every: number, lastAgo: number, amount = 100) =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(asOf, -(lastAgo + (n - 1 - i) * every)), amount }));

describe("classificação de clientes (frequência individual)", () => {
  it("cliente que compra a cada 10 dias: ativo, em risco após 15, inativo após 25", () => {
    expect(classifyCustomer(series(6, 10, 5), asOf).class).toBe("recorrente"); // 6 compras em 180 dias
    expect(classifyCustomer(series(3, 15, 5), asOf).class).toBe("ativo"); // 1ª compra há 35 dias (não é novo)
    const risk = classifyCustomer(series(3, 10, 16), asOf);
    expect(risk.class).toBe("em_risco");
    expect(risk.riskAfterDays).toBe(15);
    expect(risk.inactiveAfterDays).toBe(25);
    expect(classifyCustomer(series(3, 10, 26), asOf).class).toBe("inativo");
  });

  it("cliente mensal não fica 'em risco' com 20 dias sem comprar (régua individual)", () => {
    const m = classifyCustomer(series(4, 30, 20), asOf);
    expect(m.class).toBe("recorrente"); // 4 compras em 180 dias; 20 dias < 45 (1,5 × 30)
    expect(m.riskAfterDays).toBe(45);
    expect(m.avgIntervalDays).toBe(30);
    expect(m.expectedNextPurchase).toBe(addDays(asOf, 10));
  });

  it("histórico curto usa limites gerais configuráveis", () => {
    const m = classifyCustomer(series(2, 20, 50), asOf);
    expect(m.usesIndividualPattern).toBe(false);
    expect(m.class).toBe("em_risco"); // 50 > 45
    expect(classifyCustomer(series(2, 20, 95), asOf).class).toBe("inativo");
  });

  it("novo: primeira compra nos últimos 30 dias", () => {
    expect(classifyCustomer(series(1, 1, 10), asOf).class).toBe("novo");
  });

  it("recuperado: voltou após período de inatividade", () => {
    const orders = [...series(4, 10, 200), { date: addDays(asOf, -5), amount: 300 }];
    const m = classifyCustomer(orders, asOf);
    expect(m.class).toBe("recuperado");
    expect(m.reasons.join(" ")).toContain("voltou a comprar");
  });

  it("considera só pedidos até a data de referência e calcula valores", () => {
    const orders = [...series(3, 10, 30, 200), { date: "2026-12-01", amount: 999 }];
    const m = classifyCustomer(orders, asOf);
    expect(m.orders).toBe(3);
    expect(m.totalRevenue).toBe(600);
    expect(m.averageTicket).toBe(200);
  });

  it("limites individuais têm piso (cliente que compra todo dia)", () => {
    const m = classifyCustomer(series(40, 1, 3), asOf, { ...P }); // 1ª compra há 42 dias
    expect(m.riskAfterDays).toBe(P.minRiskDays);
    expect(m.class).toBe("recorrente");
  });

  it("sem compras: inativo sem números inventados", () => {
    const m = classifyCustomer([], asOf);
    expect(m.class).toBe("inativo");
    expect(m.lastPurchase).toBeNull();
    expect(m.averageTicket).toBeNull();
  });
});
