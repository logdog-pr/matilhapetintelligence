/**
 * Cálculo dos totais de um pedido do PedidoOK.
 *
 * A API NÃO retorna o total do pedido; ele é derivado dos itens:
 *   total_item        = quantidade × preco_liquido
 *   bruto             = Σ quantidade × preco_bruto        (itens não excluídos)
 *   itens_liquido     = Σ total_item                      (itens não excluídos)
 *   ajuste_cabecalho  = percentual → itens_liquido × valor / 100
 *                       monetario  → valor
 *                       (valores negativos = desconto, positivos = acréscimo)
 *   liquido           = itens_liquido + ajuste_cabecalho  (frete NÃO incluso)
 *   desconto          = bruto − liquido
 *   custo             = Σ quantidade × preco_custo        (custo histórico da venda)
 *   margem_item       = quantidade × (preco_liquido − preco_custo)
 *
 * ⚠ Fórmula a conferir contra relatórios oficiais do PedidoOK com dados reais
 *   (Fase 1 — critério de conclusão).
 *
 * Toda a aritmética é feita em centavos inteiros (×10^4 para quantidades)
 * para evitar erro de ponto flutuante.
 */

export interface OrderItemInput {
  quantidade: number;
  preco_bruto?: number | null;
  preco_liquido?: number | null;
  preco_custo?: number | null;
  excluido?: boolean | null;
}

export interface OrderHeaderInput {
  tipo_desconto_acrescimo?: string | null;
  valor_desconto_acrescimo?: number | null;
  itens?: OrderItemInput[] | null;
}

export interface ItemTotals {
  totalAmount: string;
  grossMargin: string | null;
}

export interface OrderTotals {
  grossAmount: string;
  netAmount: string;
  discountAmount: string;
  costAmount: string | null;
  items: ItemTotals[];
}

/** Arredonda para 2 casas (meio para longe do zero) e devolve string decimal. */
export function toMoney(value: number): string {
  const cents = Math.round(Math.abs(value) * 100 + 1e-9) * Math.sign(value);
  return (cents / 100).toFixed(2);
}

const mul = (a: number, b: number) => {
  // multiplicação em inteiros com 4 casas (quantidades e preços da API têm até 4)
  // mantém o produto abaixo de 2^53 para valores realistas
  const scale = 1e4;
  return Math.round(a * scale) * Math.round(b * scale) / (scale * scale);
};

export function computeOrderTotals(order: OrderHeaderInput): OrderTotals {
  const items = order.itens ?? [];
  let gross = 0;
  let itemsNet = 0;
  let cost = 0;
  let costKnown = true;

  const itemTotals: ItemTotals[] = items.map((it) => {
    const net = mul(it.quantidade, it.preco_liquido ?? 0);
    const hasCost = it.preco_custo !== null && it.preco_custo !== undefined;
    const margin = hasCost ? net - mul(it.quantidade, it.preco_custo as number) : null;
    if (!it.excluido) {
      gross += mul(it.quantidade, it.preco_bruto ?? it.preco_liquido ?? 0);
      itemsNet += net;
      if (hasCost) cost += mul(it.quantidade, it.preco_custo as number);
      else costKnown = false;
    }
    return { totalAmount: toMoney(net), grossMargin: margin === null ? null : toMoney(margin) };
  });

  const adjValue = order.valor_desconto_acrescimo ?? 0;
  const adjType = (order.tipo_desconto_acrescimo ?? "").toLowerCase();
  const adjustment = adjType === "percentual" ? (itemsNet * adjValue) / 100 : adjType === "monetario" ? adjValue : 0;

  const netRounded = Number(toMoney(itemsNet + adjustment));
  const grossRounded = Number(toMoney(gross));

  return {
    grossAmount: grossRounded.toFixed(2),
    netAmount: netRounded.toFixed(2),
    discountAmount: toMoney(grossRounded - netRounded),
    costAmount: costKnown ? toMoney(cost) : null,
    items: itemTotals,
  };
}

/** Status que, por padrão, contam como faturamento (configurável em app_settings). */
export const DEFAULT_REVENUE_STATUSES = ["pedido"] as const;

export function countsAsRevenue(
  order: { status: string; deletedInSource: boolean },
  revenueStatuses: readonly string[] = DEFAULT_REVENUE_STATUSES,
): boolean {
  return !order.deletedInSource && revenueStatuses.includes(order.status.toLowerCase());
}
