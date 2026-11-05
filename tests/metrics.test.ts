import { describe, expect, it } from "vitest";
import { computeGoalProgress, countDays } from "@/lib/metrics/goals";
import { computeOrderTotals, countsAsRevenue } from "@/lib/metrics/orders";
import { receivableStatus } from "@/lib/pedidook/mappers";

describe("totais do pedido", () => {
  it("aplica desconto percentual do cabeçalho", () => {
    const t = computeOrderTotals({
      tipo_desconto_acrescimo: "percentual",
      valor_desconto_acrescimo: -10,
      itens: [{ quantidade: 3, preco_bruto: 12, preco_liquido: 10, preco_custo: 6 }],
    });
    expect(t.netAmount).toBe("27.00");
    expect(t.grossAmount).toBe("36.00");
    expect(t.discountAmount).toBe("9.00");
    expect(t.costAmount).toBe("18.00");
    expect(t.items[0]).toEqual({ totalAmount: "30.00", grossMargin: "12.00" });
  });

  it("aplica ajuste monetário e ignora itens excluídos", () => {
    const t = computeOrderTotals({
      tipo_desconto_acrescimo: "monetario",
      valor_desconto_acrescimo: 5,
      itens: [
        { quantidade: 2, preco_liquido: 10.1 },
        { quantidade: 1, preco_liquido: 99, excluido: true },
      ],
    });
    expect(t.netAmount).toBe("25.20");
    expect(t.costAmount).toBeNull(); // custo desconhecido → não inventa
  });

  it("evita erro de ponto flutuante", () => {
    const t = computeOrderTotals({ itens: [{ quantidade: 3, preco_liquido: 0.1 }] });
    expect(t.netAmount).toBe("0.30");
  });

  it("pedidos excluídos, orçamentos, bonificações e trocas não contam como faturamento", () => {
    expect(countsAsRevenue({ status: "pedido", deletedInSource: false })).toBe(true);
    expect(countsAsRevenue({ status: "pedido", deletedInSource: true })).toBe(false);
    for (const status of ["orcamento", "bonificacao", "troca"]) expect(countsAsRevenue({ status, deletedInSource: false })).toBe(false);
  });
});

describe("metas", () => {
  it("calcula percentual, restante, meta diária e projeção (dias corridos)", () => {
    const g = computeGoalProgress({ target: 30000, realized: 12000, periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-10" });
    expect(g.percent).toBe(40);
    expect(g.remaining).toBe(18000);
    expect(g.daysTotal).toBe(30);
    expect(g.daysElapsed).toBe(10);
    expect(g.daysRemaining).toBe(21);
    expect(g.dailyNeeded).toBeCloseTo(857.14, 2);
    expect(g.projection).toBe(36000);
    expect(g.projectionPercent).toBe(120);
  });

  it("dias úteis descontam fins de semana e feriados", () => {
    // novembro/2026: 21 dias úteis; com o feriado de 20/11 (sexta), 20
    expect(countDays("2026-11-01", "2026-11-30", "UTEIS")).toBe(21);
    expect(countDays("2026-11-01", "2026-11-30", "UTEIS", ["2026-11-20"])).toBe(20);
    const g = computeGoalProgress({
      target: 20000, realized: 5000, periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-01", dayMode: "UTEIS",
    });
    // domingo 01/11: nenhum dia útil decorrido → sem projeção, sem divisão por zero
    expect(g.daysElapsed).toBe(0);
    expect(g.projection).toBeNull();
    expect(g.dailyNeeded).toBeCloseTo(15000 / 21, 2);
  });

  it("não divide por zero: sem meta, período futuro e período encerrado", () => {
    const sem = computeGoalProgress({ target: 0, realized: 100, periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-10" });
    expect(sem.percent).toBeNull();
    expect(sem.dailyNeeded).toBeNull();

    const futuro = computeGoalProgress({ target: 1000, realized: 0, periodStart: "2026-12-01", periodEnd: "2026-12-31", today: "2026-11-10" });
    expect(futuro.phase).toBe("futuro");
    expect(futuro.projection).toBeNull();
    expect(futuro.daysRemaining).toBe(31);

    const fim = computeGoalProgress({ target: 1000, realized: 800, periodStart: "2026-10-01", periodEnd: "2026-10-31", today: "2026-11-10" });
    expect(fim.daysRemaining).toBe(0);
    expect(fim.dailyNeeded).toBeNull();
    expect(fim.projection).toBe(800);
  });

  it("meta superada informa o excedente", () => {
    const g = computeGoalProgress({ target: 1000, realized: 1250, periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-20" });
    expect(g.percent).toBe(125);
    expect(g.remaining).toBe(0);
    expect(g.exceededBy).toBe(250);
    expect(g.dailyNeeded).toBeNull();
  });
});

describe("status de cobrança derivado", () => {
  const base = { amount: "100.00", discount: "0", amountPaid: null, paymentDate: null, deletedInSource: false };
  it("pago, parcial, vencido e a vencer", () => {
    expect(receivableStatus({ ...base, dueDate: "2026-11-01", paymentDate: "2026-11-01", amountPaid: "100" }, "2026-11-04")).toBe("pago");
    expect(receivableStatus({ ...base, dueDate: "2026-11-10", amountPaid: "40" }, "2026-11-04")).toBe("parcial");
    expect(receivableStatus({ ...base, dueDate: "2026-11-01" }, "2026-11-04")).toBe("vencido");
    expect(receivableStatus({ ...base, dueDate: "2026-11-10" }, "2026-11-04")).toBe("a_vencer");
    expect(receivableStatus({ ...base, dueDate: "2026-11-01", amountPaid: "90", paymentDate: "2026-11-01", discount: "10" }, "2026-11-04")).toBe("pago");
  });
});
