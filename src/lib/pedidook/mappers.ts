/**
 * Conversão API PedidoOK → linhas do banco. Funções puras.
 * As FKs internas (UUID) são resolvidas depois, no sync, a partir dos *_pedidook_id.
 */
import { computeOrderTotals } from "@/lib/metrics/orders";
import { normalizeSourceTimestamp } from "./client";
import type { Cliente, Cobranca, CondicaoPagamento, Fornecedor, Pedido, Produto, TabelaPreco, Vendedor } from "./schemas";

const n = (v: number | null | undefined) => (v === null || v === undefined ? null : String(v));
const s = (v: string | null | undefined) => (v === null || v === undefined || v.trim() === "" ? null : v.trim());
const ts = (v: string | null | undefined) => (v ? normalizeSourceTimestamp(v) : null);
const digits = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d === "" ? null : d;
};

const common = (r: { excluido: boolean; ultima_alteracao: string }) => ({
  deletedInSource: r.excluido,
  active: !r.excluido,
  pedidookUpdatedAt: ts(r.ultima_alteracao),
});

export function mapVendedor(r: Vendedor) {
  return {
    pedidookId: r.id,
    name: r.nome,
    region: s(r.regiao),
    licenseValidUntil: s(r.validade_licenca),
    ...common(r),
    raw: r,
  };
}

export function mapFornecedor(r: Fornecedor) {
  return {
    pedidookId: r.id,
    name: r.razao_social,
    tradeName: s(r.fantasia),
    cnpj: digits(r.cnpj_cpf),
    phone: s(r.telefone) ?? s(r.celular),
    email: s(r.email),
    ...common(r),
    raw: r,
  };
}

/** Aceita só coordenadas plausíveis no Brasil (descarta 0,0 e valores trocados/vazios). */
export function validCoords(lat: number | null | undefined, lng: number | null | undefined) {
  const ok = typeof lat === "number" && typeof lng === "number" && lat > -34.5 && lat < 6 && lng > -74.5 && lng < -28;
  return { latitude: ok ? lat.toFixed(7) : null, longitude: ok ? lng.toFixed(7) : null };
}

export function mapCliente(r: Cliente) {
  const e = r.endereco ?? {};
  return {
    pedidookId: r.id,
    code: s(r.codigo),
    corporateName: r.razao_social,
    tradeName: s(r.fantasia),
    cnpj: digits(r.cnpj_cpf),
    phone: s(r.telefone),
    email: s(r.email_copia_pedido),
    segment: s(r.segmento),
    street: s(e.logradouro),
    number: s(e.numero),
    district: s(e.bairro),
    city: s(e.cidade),
    state: s(e.uf),
    zip: digits(e.cep),
    ...validCoords(r.latitude, r.longitude),
    creditLimit: n(r.limite_credito),
    ...common(r),
    raw: r,
  };
}

export function mapProduto(r: Produto) {
  return {
    pedidookId: r.id,
    sku: r.codigo,
    barcode: s(r.codigo_barra),
    name: r.nome,
    brand: s(r.marca),
    category: s(r.categoria),
    packaging: s(r.embalagem),
    packageQty: n(r.qtd_embalagem),
    salePrice: n(r.venda),
    // custo 0 = não cadastrado no PedidoOK (não é custo zero de verdade)
    purchaseCost: typeof r.custo === "number" && r.custo > 0 ? String(r.custo) : null,
    currentStock: n(r.estoque),
    minimumStock: n(r.estoque_minimo),
    commissionPct: n(r.comissao),
    expiresOn: s(r.validade),
    supplierPedidookId: r.id_fornecedor ?? null,
    ...common(r),
    raw: r,
  };
}

export function mapCondicaoPagamento(r: CondicaoPagamento) {
  return {
    pedidookId: r.id,
    installmentsDays: r.prazos ?? [],
    deletedInSource: r.excluido,
    pedidookUpdatedAt: ts(r.ultima_alteracao),
    raw: r,
  };
}

export function mapTabelaPreco(r: TabelaPreco) {
  return {
    pedidookId: r.id,
    name: r.nome,
    inactive: !!r.inativa,
    deletedInSource: r.excluido,
    pedidookUpdatedAt: ts(r.ultima_alteracao),
    raw: r,
  };
}

export function mapPedido(r: Pedido) {
  const totals = computeOrderTotals(r);
  const itens = r.itens ?? [];
  return {
    order: {
      pedidookId: r.id,
      number: r.numero ?? null,
      customerPedidookId: r.id_cliente,
      sellerPedidookId: r.id_vendedor,
      orderDate: r.emissao.slice(0, 10),
      billingDate: s(r.faturamento),
      status: r.status.toLowerCase(),
      situation: s(r.situacao)?.toLowerCase() ?? null,
      grossAmount: totals.grossAmount,
      discountAmount: totals.discountAmount,
      netAmount: totals.netAmount,
      costAmount: totals.costAmount,
      freightAmount: n(r.valor_frete),
      headerAdjustmentType: s(r.tipo_desconto_acrescimo)?.toLowerCase() ?? null,
      headerAdjustmentValue: n(r.valor_desconto_acrescimo),
      paymentConditionPedidookId: r.id_cond_pagto ?? null,
      paymentMethod: s(r.forma_pagamento),
      priceTablePedidookId: r.id_tabela_preco ?? null,
      deletedInSource: r.excluido,
      pedidookUpdatedAt: ts(r.ultima_alteracao),
      raw: r,
    },
    items: itens.map((it, i) => ({
      productPedidookId: it.id_produto,
      quantity: String(it.quantidade),
      packaging: s(it.embalagem),
      packageQty: n(it.qtd_embalagem),
      grossUnitPrice: n(it.preco_bruto),
      unitPrice: String(it.preco_liquido ?? 0),
      unitCostSnapshot: n(it.preco_custo),
      discountPct: n(it.percentual_desconto_acrescimo),
      totalAmount: totals.items[i].totalAmount,
      grossMargin: totals.items[i].grossMargin,
      deletedInSource: !!it.excluido,
      pedidookUpdatedAt: ts(it.ultima_alteracao),
      raw: it,
    })),
  };
}

export function mapCobranca(r: Cobranca) {
  return {
    pedidookId: r.id,
    customerPedidookId: r.id_cliente,
    orderPedidookId: r.id_pedido ?? null,
    reference: s(r.referente),
    dueDate: r.vencimento.slice(0, 10),
    paymentDate: s(r.pagamento),
    amount: String(r.valor ?? 0),
    amountPaid: n(r.valor_pago),
    discount: n(r.desconto),
    interest: n(r.valor_juros),
    fine: n(r.valor_multa),
    surcharge: n(r.acrescimo),
    paymentMethod: s(r.forma_pagamento),
    deletedInSource: r.excluido,
    pedidookUpdatedAt: ts(r.ultima_alteracao),
    raw: r,
  };
}

/**
 * Status derivado de uma cobrança (a API não tem campo status).
 * ⚠ Regra a validar com dados reais.
 */
export type ReceivableStatus = "pago" | "parcial" | "vencido" | "a_vencer" | "excluido";

export function receivableStatus(
  r: { dueDate: string; paymentDate: string | null; amount: string; amountPaid: string | null; discount: string | null; deletedInSource: boolean },
  today: string,
): ReceivableStatus {
  if (r.deletedInSource) return "excluido";
  const due = Number(r.amount) - Number(r.discount ?? 0);
  const paid = Number(r.amountPaid ?? 0);
  if (r.paymentDate && paid + 0.005 >= due) return "pago";
  if (paid > 0) return r.dueDate < today ? "vencido" : "parcial";
  return r.dueDate < today ? "vencido" : "a_vencer";
}
