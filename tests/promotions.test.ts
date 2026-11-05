import { describe, expect, it } from "vitest";
import {
  availableForPromotion,
  DEFAULT_PROMOTION_PARAMS as P,
  discountedPrice,
  marginPct,
  minPriceForMargin,
  suggestBundle,
  suggestForProduct,
  type ProductSignal,
} from "@/lib/metrics/promotions";

const base: ProductSignal = {
  productId: "p1",
  name: "Ração",
  sku: "RA",
  currentStock: 100,
  minimumStock: 10,
  unitCost: 60,
  salePrice: 100,
  avgDailyDemand: 1,
  sold30: 30,
  sold60: 60,
  status: "ok",
  daysSinceLastSale: 1,
};

describe("fórmulas de preço (spec §12)", () => {
  it("margem e preço mínimo para margem desejada", () => {
    expect(marginPct(100, 60)).toBe(40);
    expect(minPriceForMargin(60, 25)).toBe(80); // 60 / (1 − 0,25)
    expect(marginPct(null, 60)).toBeNull();
  });

  it("desconto limitado pelo desconto máximo e pela margem mínima", () => {
    const d = discountedPrice(100, 60, 50, P)!; // pede 50%, máximo 20%
    expect(d.price).toBe(80);
    expect(d.discountPct).toBe(20);
    expect(d.marginPct).toBe(25);
    const tight = discountedPrice(100, 82, 20, P)!; // margem mínima 15% → piso 96,47
    expect(tight.price).toBeCloseTo(96.47, 2);
    expect(tight.limitedByMargin).toBe(true);
    expect(discountedPrice(100, 90, 20, P)).toBeNull(); // sem espaço para desconto
  });

  it("estoque protegido: mínimo cadastrado ou mínimo da regra", () => {
    expect(availableForPromotion({ currentStock: 100, minimumStock: 10 }, P)).toBe(90);
    expect(availableForPromotion({ currentStock: 100, minimumStock: 10 }, { ...P, protectedMinStock: 50 })).toBe(50);
    expect(availableForPromotion({ currentStock: 5, minimumStock: 10 }, P)).toBe(0);
  });
});

describe("sugestões por produto", () => {
  it("parado: desconto máximo, escoa % do disponível e informa capital liberado", () => {
    const s = suggestForProduct({ ...base, status: "parado", daysSinceLastSale: 120, sold30: 0, sold60: 0 })!;
    expect(s.type).toBe("parado");
    expect(s.suggestedPrice).toBe(80);
    expect(s.potentialQty).toBe(27); // 30% de 90
    expect(s.estimatedRevenue).toBe(2160);
    expect(s.estimatedProfit).toBe(540); // 27 × (80 − 60)
    expect(s.capitalFreed).toBe(1620);
    expect(s.situation).toContain("120 dias");
  });

  it("excesso: só o que passa da cobertura-alvo, com metade do desconto máximo", () => {
    const s = suggestForProduct({ ...base, status: "excesso", avgDailyDemand: 0.5 })!; // alvo 30 un.; excedente 70
    expect(s.type).toBe("excesso");
    expect(s.discountPct).toBe(10);
    expect(s.potentialQty).toBe(21); // 30% de 70
  });

  it("queda de vendas", () => {
    const s = suggestForProduct({ ...base, sold30: 10, sold60: 40 })!; // 30 antes → 10 agora (−66%)
    expect(s.type).toBe("queda_vendas");
    expect(s.potentialQty).toBe(20);
  });

  it("margem elevada: sem desconto, venda ativa", () => {
    const s = suggestForProduct({ ...base, unitCost: 50 })!; // margem 50%
    expect(s.type).toBe("margem_alta");
    expect(s.discountPct).toBe(0);
    expect(s.potentialQty).toBe(6); // 20% de 30
  });

  it("não sugere sem preço/custo, sem estoque disponível ou sem sinal", () => {
    expect(suggestForProduct({ ...base, unitCost: null, status: "parado" })).toBeNull();
    expect(suggestForProduct({ ...base, currentStock: 8, status: "parado" })).toBeNull();
    expect(suggestForProduct({ ...base, unitCost: 70 })).toBeNull(); // margem 30%, vendas estáveis: sem sinal
  });
});

describe("venda casada", () => {
  const a = { ...base, productId: "a", sku: "A", name: "Ração" };
  const b = { ...base, productId: "b", sku: "B", name: "Petisco", salePrice: 20, unitCost: 10 };

  it("sugere B junto de A pela taxa de conversão observada", () => {
    const s = suggestBundle({ a, b, together: 10, ordersWithA: 40 })!; // confiança 25%
    expect(s.type).toBe("venda_casada");
    expect(s.relatedProductId).toBe("a");
    expect(s.discountPct).toBe(5);
    expect(s.potentialQty).toBe(8); // 30 pedidos sem B × 25% = 7,5 → 8
  });

  it("ignora pares raros ou de baixa confiança", () => {
    expect(suggestBundle({ a, b, together: 2, ordersWithA: 4 })).toBeNull();
    expect(suggestBundle({ a, b, together: 3, ordersWithA: 100 })).toBeNull();
  });
});
