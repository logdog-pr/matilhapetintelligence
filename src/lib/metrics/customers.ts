/**
 * Classificação de clientes (spec §10) pela frequência histórica INDIVIDUAL.
 *
 * Regras (configuráveis):
 *  - Intervalo médio de recompra = média dos dias entre datas de compra distintas.
 *  - Com histórico suficiente (≥ minOrdersForPattern compras):
 *      em risco  → dias sem comprar > intervalo médio × riskFactor  (1,5)
 *      inativo   → dias sem comprar > intervalo médio × inactiveFactor (2,5)
 *    Sem histórico suficiente: limites gerais (generalRiskDays / generalInactiveDays).
 *    Os limites individuais nunca ficam abaixo de minRiskDays / minInactiveDays.
 *  - Novo: primeira compra registrada nos últimos newDays (30) dias.
 *  - Recuperado: voltou a comprar nos últimos recoveredWindowDays depois de um
 *    intervalo que, pela regra acima, o classificaria como inativo.
 *  - Recorrente: ativo com ≥ recurringMinOrders compras nos últimos recurringWindowDays.
 *  - Precedência: novo > recuperado > inativo > em risco > recorrente > ativo.
 *
 * ⚠ "Novo" depende do histórico que o PedidoOK disponibilizou: um cliente antigo
 *   cuja primeira compra não foi importada aparece como novo.
 */

export type CustomerClass = "novo" | "recuperado" | "inativo" | "em_risco" | "recorrente" | "ativo";

export const CLASS_LABELS: Record<CustomerClass, string> = {
  novo: "Novo",
  recuperado: "Recuperado",
  inativo: "Inativo",
  em_risco: "Em risco",
  recorrente: "Recorrente",
  ativo: "Ativo",
};

export interface ClassificationParams {
  riskFactor: number;
  inactiveFactor: number;
  minOrdersForPattern: number;
  generalRiskDays: number;
  generalInactiveDays: number;
  minRiskDays: number;
  minInactiveDays: number;
  newDays: number;
  recoveredWindowDays: number;
  recurringMinOrders: number;
  recurringWindowDays: number;
}

export const DEFAULT_CLASSIFICATION_PARAMS: ClassificationParams = {
  riskFactor: 1.5,
  inactiveFactor: 2.5,
  minOrdersForPattern: 3,
  generalRiskDays: 45,
  generalInactiveDays: 90,
  minRiskDays: 7,
  minInactiveDays: 14,
  newDays: 30,
  recoveredWindowDays: 60,
  recurringMinOrders: 4,
  recurringWindowDays: 180,
};

export interface CustomerOrder {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface CustomerMetrics {
  class: CustomerClass;
  orders: number;
  purchaseDays: number;
  firstPurchase: string | null;
  lastPurchase: string | null;
  daysWithoutBuying: number | null;
  avgIntervalDays: number | null;
  /** Limites usados para esse cliente. */
  riskAfterDays: number;
  inactiveAfterDays: number;
  usesIndividualPattern: boolean;
  /** Data esperada da próxima compra (última + intervalo médio). */
  expectedNextPurchase: string | null;
  totalRevenue: number;
  averageTicket: number | null;
  /** Faturamento médio por mês de relacionamento (valor em jogo se o cliente parar). */
  monthlyRevenue: number;
  reasons: string[];
}

const DAY = 86_400_000;
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const diff = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);
const r2 = (v: number) => Math.round(v * 100) / 100;
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function thresholds(dates: string[], p: ClassificationParams) {
  if (dates.length >= p.minOrdersForPattern) {
    const gaps = dates.slice(1).map((d, i) => diff(dates[i], d));
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    return {
      avg,
      risk: Math.max(p.minRiskDays, Math.round(avg * p.riskFactor)),
      inactive: Math.max(p.minInactiveDays, Math.round(avg * p.inactiveFactor)),
      individual: true,
    };
  }
  const avg = dates.length >= 2 ? diff(dates[0], dates[dates.length - 1]) / (dates.length - 1) : null;
  return { avg, risk: p.generalRiskDays, inactive: p.generalInactiveDays, individual: false };
}

/**
 * Classifica um cliente na data `asOf`, considerando só compras até essa data.
 * `orders` = pedidos que contam como faturamento (podem repetir datas).
 */
export function classifyCustomer(orders: CustomerOrder[], asOf: string, p: ClassificationParams = DEFAULT_CLASSIFICATION_PARAMS): CustomerMetrics {
  const valid = orders.filter((o) => o.date <= asOf);
  const dates = [...new Set(valid.map((o) => o.date))].sort();
  const totalRevenue = r2(valid.reduce((s, o) => s + o.amount, 0));
  const reasons: string[] = [];

  if (dates.length === 0) {
    return {
      class: "inativo",
      orders: 0,
      purchaseDays: 0,
      firstPurchase: null,
      lastPurchase: null,
      daysWithoutBuying: null,
      avgIntervalDays: null,
      riskAfterDays: p.generalRiskDays,
      inactiveAfterDays: p.generalInactiveDays,
      usesIndividualPattern: false,
      expectedNextPurchase: null,
      totalRevenue: 0,
      averageTicket: null,
      monthlyRevenue: 0,
      reasons: ["nenhuma compra registrada no histórico importado"],
    };
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const since = diff(last, asOf);
  const t = thresholds(dates, p);
  const months = Math.max(1, diff(first, asOf) / 30.44);
  const monthlyRevenue = r2(totalRevenue / months);

  if (t.individual) reasons.push(`intervalo médio de ${Math.round(t.avg!)} dias entre compras (${dates.length} compras)`);
  else reasons.push(`histórico curto (${dates.length} compra(s)): limites gerais de ${p.generalRiskDays}/${p.generalInactiveDays} dias`);

  // Recuperado: o intervalo antes da última compra ultrapassou o limite de inatividade
  let recovered = false;
  if (dates.length >= 2 && diff(last, asOf) <= p.recoveredWindowDays) {
    const before = dates.slice(0, -1);
    const tb = thresholds(before, p);
    const gap = diff(before[before.length - 1], last);
    if (gap > tb.inactive) {
      recovered = true;
      reasons.push(`voltou a comprar em ${br(last)} após ${gap} dias sem compra (limite de inatividade: ${tb.inactive})`);
    }
  }

  const recentOrders = dates.filter((d) => diff(d, asOf) <= p.recurringWindowDays).length;

  let cls: CustomerClass;
  if (diff(first, asOf) <= p.newDays) {
    cls = "novo";
    reasons.push(`primeira compra registrada há ${diff(first, asOf)} dias`);
  } else if (recovered) cls = "recuperado";
  else if (since > t.inactive) {
    cls = "inativo";
    reasons.push(`${since} dias sem comprar (> ${t.inactive})`);
  } else if (since > t.risk) {
    cls = "em_risco";
    reasons.push(`${since} dias sem comprar (> ${t.risk})`);
  } else if (recentOrders >= p.recurringMinOrders) {
    cls = "recorrente";
    reasons.push(`${recentOrders} compras nos últimos ${p.recurringWindowDays} dias`);
  } else cls = "ativo";

  return {
    class: cls,
    orders: valid.length,
    purchaseDays: dates.length,
    firstPurchase: first,
    lastPurchase: last,
    daysWithoutBuying: since,
    avgIntervalDays: t.avg === null ? null : r2(t.avg),
    riskAfterDays: t.risk,
    inactiveAfterDays: t.inactive,
    usesIndividualPattern: t.individual,
    expectedNextPurchase: t.avg === null ? null : toISO(toMs(last) + Math.round(t.avg) * DAY),
    totalRevenue,
    averageTicket: valid.length ? r2(totalRevenue / valid.length) : null,
    monthlyRevenue,
    reasons,
  };
}

/** Classes que contam como "ativos" nos indicadores agregados. */
export const ACTIVE_CLASSES: CustomerClass[] = ["ativo", "recorrente", "novo", "recuperado"];
