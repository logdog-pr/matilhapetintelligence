/**
 * Cálculo dos totais de um pedido do PedidoOK.
 *
 * A API NÃO retorna o total do pedido; ele é derivado dos itens:
 *   total_item        = quantidade × preco_liquido
 *   bruto             = Σ quantidade × preco_bruto        (itens não excluídos)
 *   itens_liquido     = Σ total_item                      (itens não excluídos)
 *   ajuste_cabecalho  = percentual → 0 (o PedidoOK JÁ aplica o percentual no preco_liquido dos itens)
 *                       monetario ou tipo vazio → valor (o desconto em R$ NÃO é distribuído nos itens)
 *                       (valores negativos = desconto, positivos = acréscimo)
 *   liquido           = itens_liquido + ajuste_cabecalho  (frete NÃO incluso)
 *   desconto          = bruto − liquido
 *   custo             = Σ quantidade × preco_custo        (custo histórico da venda)
 *   margem_item       = quantidade × (preco_liquido − preco_custo)
 *
 * preco_custo ≤ 0 é tratado como custo DESCONHECIDO: desde 2025 a conta envia 0
 * quando o custo não está cadastrado, o que geraria margem falsa de 100%.
 *
 * Validado com dados reais (05/11/2026) contra as cobranças geradas pelo PedidoOK:
 * Σ parcelas = liquido + frete em ~96% dos pedidos com cobrança; as diferenças
 * restantes são edições manuais (parcelas duplicadas, itens excluídos depois).
 * - percentual: ex. preco_bruto 377, cabeçalho −10% → preco_liquido 339,30.
 * - monetário: chega com tipo_desconto_acrescimo = null e valor ≠ 0.
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
    const hasCost = typeof it.preco_custo === "number" && it.preco_custo > 0;
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
  // percentual já está embutido no preco_liquido; qualquer outro tipo (monetario, vazio) é valor em R$.
  const adjustment = adjType === "percentual" ? 0 : adjValue;

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
