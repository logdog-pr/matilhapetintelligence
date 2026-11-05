/**
 * Schemas Zod fiéis à documentação oficial do PedidoOK
 * (https://docs.api.pedidook.com.br/). Campos não obrigatórios na doc são
 * aceitos como opcionais/nulos; campos extras são preservados (looseObject)
 * e o JSON bruto é armazenado em `raw`.
 */
import { z } from "zod";

const str = z.string().nullish();
const num = z.number().nullish();
const dateStr = z.string().nullish(); // YYYY-MM-DD

const base = {
  id: z.number().int(),
  ultima_alteracao: z.string(),
  excluido: z.boolean(),
  id_parceiro: str,
};

export const enderecoSchema = z
  .looseObject({
    logradouro: str,
    numero: str,
    complemento: str,
    bairro: str,
    cidade: str,
    uf: str,
    cep: str,
  })
  .nullish();

export const clienteSchema = z.looseObject({
  ...base,
  codigo: str,
  razao_social: z.string(),
  fantasia: str,
  cnpj_cpf: str,
  telefone: str,
  ie_rg: str,
  email_copia_pedido: str,
  email_xml_nfe: str,
  endereco: enderecoSchema,
  endereco_cobranca: enderecoSchema,
  endereco_entrega: enderecoSchema,
  limite_credito: num,
  segmento: str,
  atendimento: str,
  latitude: num,
  longitude: num,
});

export const produtoSchema = z.looseObject({
  ...base,
  codigo: z.string(),
  nome: z.string(),
  embalagem: str,
  qtd_embalagem: num,
  venda: num,
  custo: num,
  estoque: num,
  estoque_minimo: num,
  validade: dateStr,
  comissao: num,
  ipi: num,
  peso: num,
  codigo_barra: str,
  referencia: str,
  ncm: str,
  marca: str,
  categoria: str,
  id_fornecedor: z.number().int().nullish(),
  grades: z.array(z.string()).nullish(),
});

export const vendedorSchema = z.looseObject({
  ...base,
  nome: z.string(),
  regiao: str,
  informacao_adicional: str,
  validade_licenca: dateStr,
});

export const fornecedorSchema = z.looseObject({
  ...base,
  razao_social: z.string(),
  fantasia: str,
  cnpj_cpf: str,
  telefone: str,
  celular: str,
  email: str,
  contato: str,
});

export const condicaoPagamentoSchema = z.looseObject({
  ...base,
  prazos: z.array(z.number()).nullish(),
});

export const tabelaPrecoSchema = z.looseObject({
  ...base,
  nome: z.string(),
  inativa: z.boolean().nullish(),
});

export const itemPedidoSchema = z.looseObject({
  ultima_alteracao: z.string().nullish(),
  excluido: z.boolean().nullish(),
  id_produto: z.number().int(),
  quantidade: z.number(),
  embalagem: str,
  qtd_embalagem: num,
  preco_bruto: num,
  preco_liquido: num,
  preco_custo: num,
  percentual_desconto_acrescimo: num,
  observacao: str,
  grades: z.array(z.looseObject({ tamanho_cor: str, quantidade: num })).nullish(),
});

export const pedidoSchema = z.looseObject({
  ...base,
  numero: z.number().int().nullish(),
  id_vendedor: z.number().int(),
  id_cliente: z.number().int(),
  status: z.string(),
  situacao: str,
  emissao: z.string(),
  faturamento: dateStr,
  tipo_desconto_acrescimo: str,
  valor_desconto_acrescimo: num,
  id_cond_pagto: z.number().int().nullish(),
  condicao_pagamento: z.array(z.number()).nullish(),
  id_tabela_preco: z.number().int().nullish(),
  tipo_frete: str,
  valor_frete: num,
  previsao_entrega: dateStr,
  forma_pagamento: str,
  base_vencimento: str,
  itens: z.array(itemPedidoSchema).nullish(),
});

export const cobrancaSchema = z.looseObject({
  ...base,
  id_cliente: z.number().int(),
  id_pedido: z.number().int().nullish(),
  vencimento: z.string(),
  pagamento: dateStr,
  referente: str,
  valor: num,
  valor_pago: num,
  desconto: num,
  valor_multa: num,
  valor_juros: num,
  acrescimo: num,
  forma_pagamento: str,
});

/** Vendedor retornado em GET /clientes/{id}/vendedores */
export const clienteVendedorSchema = vendedorSchema;

export const erroSchema = z.object({
  erros: z.array(z.object({ codigo: z.number(), mensagem: z.string() })),
});

export type Cliente = z.infer<typeof clienteSchema>;
export type Produto = z.infer<typeof produtoSchema>;
export type Vendedor = z.infer<typeof vendedorSchema>;
export type Fornecedor = z.infer<typeof fornecedorSchema>;
export type CondicaoPagamento = z.infer<typeof condicaoPagamentoSchema>;
export type TabelaPreco = z.infer<typeof tabelaPrecoSchema>;
export type Pedido = z.infer<typeof pedidoSchema>;
export type ItemPedido = z.infer<typeof itemPedidoSchema>;
export type Cobranca = z.infer<typeof cobrancaSchema>;
