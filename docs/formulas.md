# Fórmulas dos indicadores

Cada fórmula aponta para o código que a implementa e para o teste que a cobre.

## Pedido ([src/lib/metrics/orders.ts](../src/lib/metrics/orders.ts))
A API **não** devolve o total do pedido. Ele é calculado a partir dos itens não excluídos:

| Campo | Fórmula |
|---|---|
| total do item | `quantidade × preco_liquido` |
| bruto (`gross_amount`) | `Σ quantidade × preco_bruto` |
| ajuste do cabeçalho | `percentual`: **0**, porque o PedidoOK já embute o percentual no `preco_liquido` dos itens · `monetario` ou tipo vazio: `valor` (negativo = desconto) |
| líquido (`net_amount`) | `Σ itens + ajuste` (**frete não incluso**) |
| desconto | `bruto − líquido` |
| custo (`cost_amount`) | `Σ quantidade × preco_custo`, o custo **histórico** da venda. Fica nulo se algum item não tiver custo; `preco_custo` ≤ 0 conta como **sem custo** |
| margem do item | `quantidade × (preco_liquido − preco_custo)` |

✔ Validada em 05/11/2026 com os dados reais: em ~96% dos pedidos que têm cobrança no PedidoOK, a soma das parcelas é igual a `líquido + frete`. As diferenças restantes são edições manuais (parcelas duplicadas, itens excluídos depois). Ainda vale conferir o faturamento de um mês com um relatório oficial do PedidoOK.

Depois de mudar esta fórmula, rode `pnpm db:recompute`. Ele recalcula os pedidos já importados a partir do JSON original, sem chamar a API.

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
| Clientes ativos / em risco / inativos | classificação por frequência individual (ver "Clientes"), na data final do período. Ativos = ativo + recorrente + novo + recuperado |
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

## Clientes ([src/lib/metrics/customers.ts](../src/lib/metrics/customers.ts))
Base: pedidos que contam como faturamento até a data de referência. **Vendedor:** só os pedidos dele.

| Item | Regra (configurável em `customers.classification`) |
|---|---|
| intervalo médio | média dos dias entre datas de compra distintas |
| padrão individual | a partir de 3 compras; abaixo disso, limites gerais de 45 (risco) e 90 (inativo) dias |
| em risco | dias sem comprar > 1,5 × intervalo médio (piso de 7 dias) |
| inativo | dias sem comprar > 2,5 × intervalo médio (piso de 14 dias) |
| novo | primeira compra registrada nos últimos 30 dias ⚠ depende do histórico importado |
| recuperado | última compra nos últimos 60 dias, depois de um intervalo maior que o limite de inativo calculado com o histórico anterior |
| recorrente | ativo com 4 ou mais compras nos últimos 180 dias |
| precedência | novo > recuperado > inativo > em risco > recorrente > ativo |
| próxima compra esperada | última compra + intervalo médio |
| faturamento médio mensal | faturamento acumulado ÷ meses desde a primeira compra (valor "em jogo" nas oportunidades) |

Oportunidades = clientes em risco + inativos, ordenados pelo faturamento médio mensal.

## Promoções ([src/lib/metrics/promotions.ts](../src/lib/metrics/promotions.ts))
- **Margem:** `(preço − custo) ÷ preço × 100`.
- **Preço mínimo para a margem desejada:** `custo ÷ (1 − margem)`.
- Simplificação: a margem não considera impostos, comissões e frete.
- **Preço sugerido:** `máx(preço × (1 − desconto), preço mínimo para a margem mínima)`. Sem espaço para desconto, não há sugestão.
- **Estoque disponível para promoção:** `estoque − máx(estoque mínimo cadastrado, estoque protegido)`.

| Tipo | Gatilho | Desconto | Quantidade potencial (premissa) |
|---|---|---|---|
| Produto parado | situação "parado" do estoque | desconto máximo | % de escoamento × disponível |
| Excesso | cobertura acima do limite | metade do máximo | % de escoamento × unidades acima da cobertura-alvo |
| Queda de vendas | últimos 30 dias ≥ 30% abaixo dos 30 anteriores | metade do máximo | volume perdido |
| Margem elevada | margem ≥ 40% e vendas recentes | sem desconto (venda ativa) | +20% do volume de 30 dias |
| Venda casada | par em ≥ 3 pedidos e confiança ≥ 20% (90 dias) | 5% no item adicional | pedidos do âncora sem o item × confiança |

- **Impacto:** lucro bruto estimado `qtd × (preço sugerido − custo)`.
- **Capital liberado:** `qtd × custo` (somente nos tipos parado e excesso).
- Sugestões decididas não voltam por 30 dias.
- As sugestões **nunca** alteram preços no PedidoOK.

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
