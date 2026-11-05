/**
 * Motor de recomendações comerciais (spec §12). Funções puras.
 *
 *   margem               = (preço de venda − custo) / preço de venda × 100
 *   preço mínimo p/ margem = custo / (1 − margem desejada)
 *
 * ⚠ Simplificação documentada no spec: não inclui impostos, comissões, frete e
 *   outros custos variáveis. As promoções são SUGESTÕES — nunca alteram preços no PedidoOK.
 *
 * Quantidades potenciais são ESTIMATIVAS com premissas explícitas (parâmetros),
 * exibidas na justificativa de cada sugestão.
 */

export type PromotionType = "parado" | "excesso" | "queda_vendas" | "margem_alta" | "venda_casada";

export const PROMOTION_LABELS: Record<PromotionType, string> = {
  parado: "Produto parado",
  excesso: "Excesso de estoque",
  queda_vendas: "Queda de vendas",
  margem_alta: "Margem elevada",
  venda_casada: "Venda casada",
};

export interface PromotionParams {
  /** Margem mínima permitida após desconto (%). */
  minMarginPct: number;
  /** Desconto máximo (%). */
  maxDiscountPct: number;
  /** Unidades que nunca entram em promoção (além do estoque mínimo cadastrado). */
  protectedMinStock: number;
  /** Quantidade mínima por pedido sugerida na ação. */
  minOrderQty: number;
  /** Margem a partir da qual o produto é "margem elevada" (%). */
  highMarginPct: number;
  /** Queda (%) dos últimos 30 dias vs. 30 anteriores para "queda de vendas". */
  fallingDropPct: number;
  /** Volume mínimo nos 30 dias anteriores para avaliar queda. */
  fallingMinUnits: number;
  /** Premissa: % do estoque disponível que uma promoção de parado/excesso escoa. */
  sellThroughPct: number;
  /** Cobertura-alvo (dias) usada para calcular o excesso. */
  excessTargetCoverageDays: number;
  /** Premissa: aumento de volume (%) com venda ativa de produto de margem elevada. */
  highMarginLiftPct: number;
  /** Desconto do item adicional em venda casada (%). */
  bundleDiscountPct: number;
  /** Mínimo de pedidos em que o par aparece junto (90 dias). */
  bundleMinSupport: number;
  /** Confiança mínima: pedidos com A e B ÷ pedidos com A. */
  bundleMinConfidence: number;
}

export const DEFAULT_PROMOTION_PARAMS: PromotionParams = {
  minMarginPct: 15,
  maxDiscountPct: 20,
  protectedMinStock: 0,
  minOrderQty: 1,
  highMarginPct: 40,
  fallingDropPct: 30,
  fallingMinUnits: 5,
  sellThroughPct: 30,
  excessTargetCoverageDays: 60,
  highMarginLiftPct: 20,
  bundleDiscountPct: 5,
  bundleMinSupport: 3,
  bundleMinConfidence: 0.2,
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function marginPct(price: number | null, cost: number | null): number | null {
  if (price === null || cost === null || price <= 0) return null;
  return r2(((price - cost) / price) * 100);
}

export function minPriceForMargin(cost: number, marginPctValue: number): number {
  if (marginPctValue >= 100) return Infinity;
  return r2(cost / (1 - marginPctValue / 100));
}

/**
 * Preço com desconto desejado, limitado pelo desconto máximo e pela margem mínima.
 * Retorna null quando não há espaço para desconto.
 */
export function discountedPrice(price: number, cost: number, desiredDiscountPct: number, p: PromotionParams) {
  const wanted = Math.min(desiredDiscountPct, p.maxDiscountPct);
  const byDiscount = r2(price * (1 - wanted / 100));
  const floor = minPriceForMargin(cost, p.minMarginPct);
  const finalPrice = Math.max(byDiscount, floor);
  if (finalPrice >= price) return null;
  return {
    price: r2(finalPrice),
    discountPct: r2(((price - finalPrice) / price) * 100),
    marginPct: marginPct(finalPrice, cost)!,
    limitedByMargin: floor > byDiscount,
    floorPrice: floor,
  };
}

export interface ProductSignal {
  productId: string;
  name: string;
  sku: string;
  currentStock: number | null;
  minimumStock: number | null;
  unitCost: number | null;
  salePrice: number | null;
  avgDailyDemand: number;
  sold30: number;
  sold60: number;
  status: "ruptura" | "comprar" | "excesso" | "parado" | "ok" | "sem_giro";
  daysSinceLastSale: number | null;
}

export interface Suggestion {
  type: PromotionType;
  productId: string;
  relatedProductId: string | null;
  situation: string;
  currentStock: number | null;
  unitCost: number;
  currentPrice: number;
  suggestedPrice: number;
  discountPct: number;
  estimatedMarginPct: number;
  potentialQty: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  /** Capital imobilizado liberado (quantidade × custo) — parado/excesso. */
  capitalFreed: number | null;
  /** Impacto financeiro estimado principal (lucro bruto estimado). */
  impact: number;
  reasoning: string[];
}

/** Estoque que pode entrar em promoção (protege o mínimo cadastrado e o mínimo da regra). */
export function availableForPromotion(s: Pick<ProductSignal, "currentStock" | "minimumStock">, p: PromotionParams) {
  const stock = Math.max(0, s.currentStock ?? 0);
  return Math.max(0, stock - Math.max(p.protectedMinStock, s.minimumStock ?? 0));
}

function build(
  type: PromotionType,
  s: ProductSignal,
  price: { price: number; discountPct: number; marginPct: number; limitedByMargin?: boolean },
  qty: number,
  situation: string,
  reasoning: string[],
  freesCapital: boolean,
  p: PromotionParams,
): Suggestion {
  const q = Math.max(p.minOrderQty, Math.ceil(qty));
  const cost = s.unitCost!;
  const revenue = r2(q * price.price);
  const profit = r2(q * (price.price - cost));
  const capitalFreed = freesCapital ? r2(q * cost) : null;
  if (price.limitedByMargin) reasoning.push(`desconto limitado pela margem mínima de ${p.minMarginPct}%`);
  reasoning.push("margem não considera impostos, comissões e frete (simplificação)");
  return {
    type,
    productId: s.productId,
    relatedProductId: null,
    situation,
    currentStock: s.currentStock,
    unitCost: cost,
    currentPrice: s.salePrice!,
    suggestedPrice: price.price,
    discountPct: price.discountPct,
    estimatedMarginPct: price.marginPct,
    potentialQty: q,
    estimatedRevenue: revenue,
    estimatedProfit: profit,
    capitalFreed,
    impact: profit,
    reasoning,
  };
}

/** Sugestões de um produto (no máximo uma por produto, pela prioridade parado > excesso > queda > margem alta). */
export function suggestForProduct(s: ProductSignal, p: PromotionParams = DEFAULT_PROMOTION_PARAMS): Suggestion | null {
  if (s.salePrice === null || s.salePrice <= 0 || s.unitCost === null || s.unitCost < 0) return null;
  const available = availableForPromotion(s, p);
  if (available <= 0) return null;
  const currentMargin = marginPct(s.salePrice, s.unitCost)!;

  if (s.status === "parado") {
    const d = discountedPrice(s.salePrice, s.unitCost, p.maxDiscountPct, p);
    if (!d) return null;
    const qty = (available * p.sellThroughPct) / 100;
    return build(
      "parado",
      s,
      d,
      qty,
      s.daysSinceLastSale === null ? "sem vendas no histórico importado" : `sem venda há ${s.daysSinceLastSale} dias`,
      [
        `${fmt(available)} unidades disponíveis para promoção (estoque protegido descontado)`,
        `premissa: a promoção escoa ${p.sellThroughPct}% do disponível`,
        `libera ${brl(r2(Math.ceil(qty) * s.unitCost))} de capital parado`,
      ],
      true,
      p,
    );
  }

  if (s.status === "excesso" && s.avgDailyDemand > 0) {
    const target = s.avgDailyDemand * p.excessTargetCoverageDays;
    const excessUnits = Math.min(available, Math.max(0, (s.currentStock ?? 0) - target));
    if (excessUnits > 0) {
      const d = discountedPrice(s.salePrice, s.unitCost, p.maxDiscountPct / 2, p);
      if (d) {
        const qty = (excessUnits * p.sellThroughPct) / 100;
        return build(
          "excesso",
          s,
          d,
          qty,
          `${fmt(r2((s.currentStock ?? 0) / s.avgDailyDemand))} dias de cobertura`,
          [
            `${fmt(r2(excessUnits))} unidades acima da cobertura-alvo de ${p.excessTargetCoverageDays} dias`,
            `premissa: a promoção escoa ${p.sellThroughPct}% do excedente`,
          ],
          true,
          p,
        );
      }
    }
  }

  const prev30 = Math.max(0, s.sold60 - s.sold30);
  if (prev30 >= p.fallingMinUnits) {
    const drop = ((prev30 - s.sold30) / prev30) * 100;
    if (drop >= p.fallingDropPct) {
      const d = discountedPrice(s.salePrice, s.unitCost, p.maxDiscountPct / 2, p);
      if (d) {
        return build(
          "queda_vendas",
          s,
          d,
          Math.min(available, prev30 - s.sold30),
          `vendas caíram ${fmt(r2(drop))}% (30 dias: ${fmt(s.sold30)} vs. ${fmt(prev30)} antes)`,
          ["premissa: a promoção recupera o volume perdido nos últimos 30 dias"],
          false,
          p,
        );
      }
    }
  }

  if (currentMargin >= p.highMarginPct && s.sold30 > 0 && s.status !== "ruptura") {
    const lift = Math.min(available, (s.sold30 * p.highMarginLiftPct) / 100);
    if (lift > 0) {
      return build(
        "margem_alta",
        s,
        { price: s.salePrice, discountPct: 0, marginPct: currentMargin },
        lift,
        `margem de ${fmt(currentMargin)}%`,
        [
          "sem desconto: priorizar em venda ativa/destaque para aumentar o mix rentável",
          `premissa: +${p.highMarginLiftPct}% sobre o volume dos últimos 30 dias (${fmt(s.sold30)})`,
        ],
        false,
        p,
      );
    }
  }
  return null;
}

export interface PairSignal {
  a: ProductSignal;
  b: ProductSignal;
  /** Pedidos com A e B (90 dias). */
  together: number;
  /** Pedidos com A (90 dias). */
  ordersWithA: number;
}

/** Venda casada: quem leva A costuma levar B — sugere B com desconto junto de A. */
export function suggestBundle(pair: PairSignal, p: PromotionParams = DEFAULT_PROMOTION_PARAMS): Suggestion | null {
  const { a, b } = pair;
  if (pair.together < p.bundleMinSupport || pair.ordersWithA <= 0) return null;
  const confidence = pair.together / pair.ordersWithA;
  if (confidence < p.bundleMinConfidence) return null;
  if (b.salePrice === null || b.salePrice <= 0 || b.unitCost === null) return null;
  const available = availableForPromotion(b, p);
  if (available <= 0) return null;
  const d = discountedPrice(b.salePrice, b.unitCost, p.bundleDiscountPct, p);
  if (!d) return null;
  const withoutB = pair.ordersWithA - pair.together;
  const qty = Math.min(available, withoutB * confidence);
  if (qty <= 0) return null;
  const s = build(
    "venda_casada",
    b,
    d,
    qty,
    `${Math.round(confidence * 100)}% dos pedidos com "${a.name}" também levam "${b.name}"`,
    [
      `${pair.together} de ${pair.ordersWithA} pedidos com ${a.sku} incluíram ${b.sku} (90 dias)`,
      `premissa: oferecer ${b.sku} com desconto nos ${withoutB} pedidos de ${a.sku} sem ele converte na mesma taxa`,
    ],
    false,
    p,
  );
  return { ...s, relatedProductId: a.productId };
}
