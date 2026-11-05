/**
 * Inteligência de estoque por SKU (spec §11). Funções puras, reproduzíveis e explicáveis.
 *
 *   demanda média diária = quantidade vendida no período / dias analisados
 *   cobertura (dias)     = estoque disponível / demanda média diária
 *   estoque de segurança = demanda média diária × dias de segurança
 *   ponto de reposição   = demanda média diária × prazo de entrega + estoque de segurança
 *   estoque desejado     = demanda média diária × (prazo de entrega + intervalo de revisão) + estoque de segurança
 *                          (nunca abaixo do estoque mínimo cadastrado no PedidoOK)
 *   quantidade sugerida  = máximo(0, estoque desejado − estoque disponível − compras pendentes)
 *
 * Limitações da fonte (auditoria): a API não fornece compras pendentes, prazo de
 * entrega nem movimentações; prazo é configurado por fornecedor (ou padrão) e
 * compras pendentes = 0. Sem histórico suficiente, NÃO há sugestão.
 */

export interface StockParams {
  /** Janela de demanda (dias), ex.: 90. */
  windowDays: number;
  safetyDays: number;
  reviewDays: number;
  defaultLeadTimeDays: number;
  /** Mínimo de dias de histórico de vendas importado para confiar na estimativa. */
  minHistoryDays: number;
  /** Cobertura acima disso = excesso. */
  excessCoverageDays: number;
  /** Sem venda há mais que isso (com estoque) = parado. */
  idleDays: number;
}

export const DEFAULT_STOCK_PARAMS: StockParams = {
  windowDays: 90,
  safetyDays: 7,
  reviewDays: 7,
  defaultLeadTimeDays: 7,
  minHistoryDays: 30,
  excessCoverageDays: 120,
  idleDays: 60,
};

export interface StockInput {
  currentStock: number | null;
  minimumStock: number | null;
  unitCost: number | null;
  /** Quantidades vendidas (pedidos que contam como faturamento) nas janelas até hoje. */
  sold7: number;
  sold30: number;
  sold60: number;
  sold90: number;
  /** Quantidade vendida na janela de demanda configurada (windowDays). */
  soldWindow: number;
  /** Dias distintos com venda na janela de demanda. */
  saleDaysWindow: number;
  lastSaleDate: string | null;
  /** Prazo do fornecedor (null = não configurado). */
  supplierLeadTimeDays: number | null;
  /** Dias de histórico de pedidos disponíveis no sistema (desde o 1º pedido importado). */
  historyDays: number;
  pendingPurchases?: number;
  today: string;
}

export type Quality = "boa" | "limitada" | "insuficiente";

export type StockStatus = "ruptura" | "comprar" | "excesso" | "parado" | "ok" | "sem_giro";

export interface StockAnalysis {
  daysAnalyzed: number;
  avgDailyDemand: number;
  coverageDays: number | null;
  safetyStock: number;
  reorderPoint: number;
  desiredStock: number;
  suggestedQty: number | null;
  suggestedCost: number | null;
  leadTimeDays: number;
  leadTimeIsDefault: boolean;
  daysSinceLastSale: number | null;
  stockValue: number | null;
  quality: Quality;
  qualityReasons: string[];
  status: StockStatus;
  /** Passo a passo do cálculo, para exibir ao usuário. */
  explanation: string[];
}

const DAY = 86_400_000;
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function analyzeStock(input: StockInput, params: StockParams = DEFAULT_STOCK_PARAMS): StockAnalysis {
  const stock = Math.max(0, input.currentStock ?? 0);
  const pending = input.pendingPurchases ?? 0;
  const daysAnalyzed = Math.max(0, Math.min(params.windowDays, input.historyDays));
  const avg = daysAnalyzed > 0 ? r4(input.soldWindow / daysAnalyzed) : 0;

  const leadTimeIsDefault = input.supplierLeadTimeDays === null || input.supplierLeadTimeDays === undefined;
  const lead = leadTimeIsDefault ? params.defaultLeadTimeDays : (input.supplierLeadTimeDays as number);

  const safety = r2(avg * params.safetyDays);
  const reorderPoint = r2(avg * lead + safety);
  const formulaDesired = r2(avg * (lead + params.reviewDays) + safety);
  const minimum = Math.max(0, input.minimumStock ?? 0);
  const desired = Math.max(formulaDesired, minimum);
  const coverage = avg > 0 ? r2(stock / avg) : null;
  const daysSinceLastSale = input.lastSaleDate ? Math.round((toMs(input.today) - toMs(input.lastSaleDate)) / DAY) : null;

  // Qualidade da estimativa
  const reasons: string[] = [];
  let quality: Quality = "boa";
  if (input.historyDays < params.minHistoryDays) {
    quality = "insuficiente";
    reasons.push(`apenas ${input.historyDays} dia(s) de histórico importado (mínimo ${params.minHistoryDays})`);
  } else if (input.saleDaysWindow === 0) {
    quality = "insuficiente";
    reasons.push(`nenhuma venda nos últimos ${daysAnalyzed} dias`);
  } else if (input.saleDaysWindow < 3) {
    quality = "limitada";
    reasons.push(`vendido em só ${input.saleDaysWindow} dia(s) na janela: demanda instável`);
  }
  if (leadTimeIsDefault) {
    if (quality === "boa") quality = "limitada";
    reasons.push(`prazo de entrega do fornecedor não configurado (usado padrão de ${params.defaultLeadTimeDays} dias)`);
  }
  if (input.currentStock === null) {
    quality = "insuficiente";
    reasons.push("estoque atual não informado no PedidoOK");
  }
  if (pending === 0) reasons.push("compras pendentes não disponíveis na API (consideradas 0)");

  // Sugestão só com estimativa confiável o bastante
  let suggestedQty: number | null = null;
  if (quality !== "insuficiente") {
    suggestedQty = Math.max(0, Math.ceil(desired - stock - pending));
  } else if (minimum > 0 && input.currentStock !== null && stock < minimum) {
    // sem histórico, mas abaixo do mínimo cadastrado: repõe até o mínimo
    suggestedQty = Math.ceil(minimum - stock - pending);
    reasons.push("sugestão limitada a completar o estoque mínimo cadastrado");
  }
  const suggestedCost = suggestedQty !== null && input.unitCost !== null ? r2(suggestedQty * input.unitCost) : null;

  // Situação
  let status: StockStatus;
  if (stock <= 0 && (avg > 0 || minimum > 0)) status = "ruptura";
  else if (suggestedQty !== null && suggestedQty > 0 && (stock <= reorderPoint || stock < minimum)) status = "comprar";
  else if (stock > 0 && (daysSinceLastSale === null ? input.historyDays >= params.idleDays : daysSinceLastSale > params.idleDays)) status = "parado";
  else if (coverage !== null && coverage > params.excessCoverageDays) status = "excesso";
  else if (avg === 0) status = "sem_giro";
  else status = "ok";

  const explanation = [
    `Demanda média diária = ${fmt(input.soldWindow)} vendidos ÷ ${daysAnalyzed} dias = ${fmt(avg)}/dia`,
    `Estoque de segurança = ${fmt(avg)} × ${params.safetyDays} dias = ${fmt(safety)}`,
    `Ponto de reposição = ${fmt(avg)} × ${lead} dias de prazo${leadTimeIsDefault ? " (padrão)" : ""} + ${fmt(safety)} = ${fmt(reorderPoint)}`,
    `Estoque desejado = ${fmt(avg)} × (${lead} + ${params.reviewDays} dias de revisão) + ${fmt(safety)} = ${fmt(formulaDesired)}` +
      (minimum > formulaDesired ? ` → elevado ao estoque mínimo cadastrado (${fmt(minimum)})` : ""),
    `Quantidade sugerida = máx(0, ${fmt(desired)} − ${fmt(stock)} em estoque − ${fmt(pending)} pendentes) = ${suggestedQty === null ? "sem sugestão (histórico insuficiente)" : fmt(suggestedQty)}`,
    coverage === null ? "Cobertura: sem demanda no período" : `Cobertura = ${fmt(stock)} ÷ ${fmt(avg)} = ${fmt(coverage)} dias`,
  ];

  return {
    daysAnalyzed,
    avgDailyDemand: avg,
    coverageDays: coverage,
    safetyStock: safety,
    reorderPoint,
    desiredStock: r2(desired),
    suggestedQty,
    suggestedCost,
    leadTimeDays: lead,
    leadTimeIsDefault,
    daysSinceLastSale,
    stockValue: input.unitCost !== null ? r2(stock * input.unitCost) : null,
    quality,
    qualityReasons: reasons,
    status,
    explanation,
  };
}
