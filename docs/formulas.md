# Fórmulas dos indicadores

Cada fórmula aponta para o código que a implementa e para o teste que a cobre.

## Pedido ([src/lib/metrics/orders.ts](../src/lib/metrics/orders.ts))
A API **não** devolve o total do pedido. Ele é calculado a partir dos itens não excluídos:

| Campo | Fórmula |
|---|---|
| total do item | `quantidade × preco_liquido` |
| bruto (`gross_amount`) | `Σ quantidade × preco_bruto` |
| ajuste do cabeçalho | `percentual`: `Σ itens × valor / 100` · `monetario`: `valor` (negativo = desconto) |
| líquido (`net_amount`) | `Σ itens + ajuste` (**frete não incluso**) |
| desconto | `bruto − líquido` |
| custo (`cost_amount`) | `Σ quantidade × preco_custo`, o custo **histórico** da venda. Fica nulo se algum item não tiver custo |
| margem do item | `quantidade × (preco_liquido − preco_custo)` |

⚠ Esta fórmula ainda precisa ser conferida contra um relatório oficial do PedidoOK. Isso faz parte do critério de conclusão da Fase 1.

## Faturamento ([src/lib/queries/revenue.ts](../src/lib/queries/revenue.ts))
`Σ net_amount` dos pedidos que atendem a três condições:
- `status` está em `revenue.statuses` (padrão: `pedido`). Orçamento, bonificação e troca ficam de fora.
- `excluido = false` no PedidoOK.
- a data de **emissão** está dentro do período.

Ticket médio = `faturamento ÷ nº de pedidos` (fica "—" quando não há pedidos).

Faturamento **não** é recebimento e **não** é lucro.

## Dashboard ([src/lib/queries/dashboard.ts](../src/lib/queries/dashboard.ts), [src/lib/periods.ts](../src/lib/periods.ts))
| Indicador | Definição |
|---|---|
| Faturamento, pedidos, ticket médio | como em "Faturamento" acima, no período filtrado |
| Variação | `(atual − anterior) / anterior × 100`; "sem base" quando o anterior é zero |
| Período anterior | mês atual → mesmos dias do mês anterior; mês anterior → mês retrasado; ano atual → mesmo intervalo do ano anterior; demais → janela anterior de mesmo tamanho |
| Lucro bruto estimado | `Σ líquido − Σ custo histórico` **só dos pedidos com custo conhecido** (estimativa; não é lucro líquido) |
| Margem bruta | `lucro bruto estimado ÷ faturamento dos pedidos com custo conhecido × 100`, com a cobertura exibida (% do faturamento com custo) |
| Clientes ativos / inativos | **provisório (Fase 2)**: ativo = comprou nos últimos `customers.activeDays` (90) dias até o fim do período; inativo = já comprou, mas não nesse intervalo. Substituído na Fase 4 pela frequência individual |
| Estoque crítico | produtos ativos com `estoque_minimo > 0` e `estoque ≤ estoque_minimo` (estoque **atual**, não histórico) |
| Produtos / categorias mais vendidos | `Σ total dos itens` (antes do ajuste do cabeçalho), itens não excluídos, de pedidos que contam como faturamento |
| Desempenho por vendedor | faturamento pelo `id_vendedor` oficial do pedido (sem inferência) |

Perfis: VENDEDOR vê só os próprios números, sem lucro/margem, estoque ou ranking de outros vendedores (forçado no backend).

## Metas ([src/lib/metrics/goals.ts](../src/lib/metrics/goals.ts))
| Indicador | Fórmula |
|---|---|
| % atingido | `realizado / meta × 100` (fica nulo se meta ≤ 0) |
| valor restante | `max(0, meta − realizado)` |
| meta diária necessária | `(meta − realizado) / dias restantes` (fica nulo se não há dias restantes ou se a meta já foi batida) |
| projeção (**estimativa**) | `realizado / dias decorridos × dias totais` (fica nulo antes do período começar) |

Como os dias são contados:
- dias totais: do início ao fim, inclusive.
- dias decorridos: do início até hoje, inclusive.
- dias restantes: de hoje até o fim, inclusive. O dia de hoje ainda conta como disponível para vender.
- "Dias úteis" exclui sábados, domingos e os feriados configurados em `goals.holidays`.

Novos clientes: clientes cuja primeira compra registrada cai dentro do período. Esse número depende do histórico que a API disponibilizou.

## Estoque ([src/lib/metrics/stock.ts](../src/lib/metrics/stock.ts), [src/lib/queries/stock.ts](../src/lib/queries/stock.ts))
Vendas = quantidade dos itens não excluídos de pedidos que contam como faturamento, na unidade de venda do PedidoOK.

| Indicador | Fórmula |
|---|---|
| dias analisados | `mín(janela, dias de histórico importado)` (não divide 90 dias de demanda por um histórico de 20) |
| demanda média diária | `vendido na janela ÷ dias analisados` |
| cobertura | `estoque ÷ demanda média` (sem demanda → "—") |
| estoque de segurança | `demanda × dias de segurança` |
| ponto de reposição | `demanda × prazo de entrega + segurança` |
| estoque desejado | `demanda × (prazo + intervalo de revisão) + segurança`, nunca abaixo do estoque mínimo cadastrado |
| quantidade sugerida | `máx(0, desejado − estoque − compras pendentes)`, arredondada para cima |
| custo da reposição | `sugerido × custo atual do produto` |
| valor em estoque | `estoque atual × custo atual` |

**Situações:**
- **ruptura**: sem estoque, com demanda ou mínimo cadastrado.
- **comprar**: no ponto de reposição ou abaixo dele (ou abaixo do mínimo), com sugestão > 0.
- **parado**: tem estoque e está sem venda há mais de `idleDays`.
- **excesso**: cobertura maior que `excessCoverageDays`.
- **sem giro**: sem demanda no período.
- **ok**: os demais.

**Qualidade da estimativa:**
- **insuficiente**: histórico menor que `minHistoryDays`, nenhuma venda na janela ou estoque não informado. Não há sugestão, exceto completar o estoque mínimo cadastrado.
- **limitada**: vendido em menos de 3 dias na janela, ou fornecedor sem prazo configurado (nesse caso usa o prazo padrão).
- **boa**: os demais.

**Limitações da API (auditoria):**
- Compras pendentes não existem na API e são consideradas 0.
- Prazo de entrega também não existe e é configurado manualmente por fornecedor.
- Não há movimentações de estoque. O estoque é sempre o atual, e o histórico só existe a partir dos snapshots diários.
- Sazonalidade ainda não é considerada: a janela é móvel. Isso fica para depois, quando houver histórico real.

Parâmetros (`stock.params`), editáveis pelo administrador: janela 90 d, segurança 7 d, revisão 7 d, prazo padrão 7 d, histórico mínimo 30 d, excesso > 120 d, parado > 60 d.

## Cobranças: status derivado ([src/lib/pedidook/mappers.ts](../src/lib/pedidook/mappers.ts))
A API não tem campo de status, então ele é derivado:
- **pago**: tem `pagamento` e `valor_pago ≥ valor − desconto`.
- **parcial**: pagou uma parte e ainda não venceu.
- **vencido**: venceu antes de hoje sem quitação.
- **a vencer**: o restante.

⚠ Regra a validar com dados reais (Fase 5).

## Frescor dos dados ([src/lib/queries/sync-health.ts](../src/lib/queries/sync-health.ts))
| Estado | Quando |
|---|---|
| atualizado | última sincronização há menos de 3× o intervalo do recurso |
| parcial | há uma execução pendente ou retomável |
| desatualizado | sem sucesso recente |
| indisponível | nunca sincronizado |

O estado geral é o pior entre pedidos, clientes, produtos e vendedores.
