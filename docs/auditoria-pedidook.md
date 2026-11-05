# Auditoria da API PedidoOK

Fonte: coleção Postman oficial publicada em https://docs.api.pedidook.com.br/ (consultada em 04/11/2026).
Tudo abaixo foi extraído da documentação — **ainda não validado contra uma conta real**. Itens marcados com ⚠ precisam de conferência na primeira importação.

### A1. Endpoints de leitura disponíveis (usaremos só GET)
| Recurso | Lista | Por ID | Filtros |
|---|---|---|---|
| `/clientes/` | ✔ | ✔ | alterado_apos, excluido, codigo, cnpjcpf, id_parceiro, pagina |
| `/produtos/` | ✔ | ✔ | alterado_apos, excluido, codigo, codigo_barra, id_parceiro, pagina |
| `/vendedores/` | ✔ | ✔ | alterado_apos, excluido, nome, id_parceiro, pagina |
| `/fornecedores/` | ✔ | ✔ | alterado_apos, excluido, cnpjcpf, id_parceiro, pagina |
| `/pedidos/` | ✔ (itens embutidos) | ✔ | alterado_apos, excluido, numero, id_parceiro, pagina |
| `/cobrancas/` | ✔ | ✔ | alterado_apos, excluido, id_cliente, id_parceiro, pagina |
| `/tabelas_preco/` e `/{id}/produtos` | ✔ | ✔ | alterado_apos, excluido, nome, inativa, pagina |
| `/condicoes_pagamento/` | ✔ | ✔ | alterado_apos, excluido, id_parceiro, pagina |
| `/clientes/{id}/vendedores` | ✔ (por cliente) | — | alterado_apos, pagina |
| `/clientes/{id}/tabelas_preco`, `/clientes/{id}/condicoes_pagamento`, `/vendedores/{id}/tabelas_preco` | ✔ (por entidade) | — | alterado_apos, pagina |

Também existem POST/PUT/PATCH/DELETE/undelete. **Não serão implementados** (V1 é somente leitura). Não há webhooks.

### A2. Estrutura real dos objetos (campos-chave)
- **Todos:** `id` (int), `ultima_alteracao` (datetime com microssegundos, sem fuso), `excluido` (bool), `id_parceiro`.
- **Cliente:** codigo, razao_social, fantasia, cnpj_cpf, telefone, ie_rg, endereco/endereco_cobranca/endereco_entrega {logradouro, numero, complemento, bairro, cidade, uf, cep}, limite_credito, segmento, atendimento, latitude/longitude, contatos[], referencias_bancarias[], referencias_comerciais[]. **Não tem vendedor no objeto.**
- **Produto:** codigo, nome, embalagem, qtd_embalagem, venda, custo, estoque, estoque_minimo, validade, comissao, ipi, peso, codigo_barra, referencia, ncm, marca, categoria, id_fornecedor, grades[].
- **Vendedor:** nome, regiao, informacao_adicional, validade_licenca, codigo_ativacao.
- **Fornecedor:** razao_social, fantasia, cnpj_cpf, ie_rg, endereco, contato, telefone, celular, email, site, observacao. **Não tem prazo de entrega.**
- **Condição de pagamento:** `prazos` int[].

### A3. Pedidos e itens
- **Cabeçalho:** numero, id_vendedor, id_cliente, `status` ∈ {pedido, orcamento, bonificacao, troca}, `situacao` ∈ {pendente, faturado, pago, concluido, separado, entregue} (o exemplo vem como "Pendente", então normalizar caixa), emissao (date), faturamento (date|null), tipo_desconto_acrescimo {percentual|monetario}, valor_desconto_acrescimo (negativo = desconto), id_cond_pagto / condicao_pagamento[], id_tabela_preco, tipo_frete, valor_frete, previsao_entrega, forma_pagamento, base_vencimento.
- **Item:** id_produto, quantidade, embalagem, qtd_embalagem, preco_bruto, preco_liquido, **preco_custo** (custo histórico disponível ✔), percentual_desconto_acrescimo, grades[{tamanho_cor, quantidade}], excluido, ultima_alteracao.
- **A API não traz o total do pedido.** Ele é calculado: Σ(quantidade × preco_liquido) dos itens não excluídos, depois o ajuste do cabeçalho (percentual ou monetário). O frete fica separado. Essa fórmula precisa ser conferida contra relatórios do PedidoOK com dados reais.
- **Cancelamento:** não existe status "cancelado". Pedido excluído = `excluido=true`. Devolução: só via `status=troca`. Orçamento, bonificação e troca **não entram em faturamento** por padrão (regra configurável).
- Itens não têm ID próprio. A chave é (pedido, id_produto), e o PedidoOK proíbe produto duplicado no mesmo pedido (erro 27).

### A4. Vendedor
- `pedidos.id_vendedor` é obrigatório: atribuição oficial confiável ✔.
- A ligação cliente↔vendedor é **N:N** e só existe via `/clientes/{id}/vendedores`, **uma requisição por cliente**. Vai para a tabela `customer_sellers` em vez de `customers.seller_id` único.

### A5. Estoque
- Só existe o estoque atual (`produtos.estoque`) e `estoque_minimo`. **Não há movimentações, compras pendentes nem prazo de entrega.** Histórico de estoque só a partir dos nossos snapshots diários (`stock_snapshots`, começando na primeira sincronização). Prazo de entrega: configuração manual por fornecedor (Fase 3).

### A6. Cobranças e pagamentos
- id_cliente, id_pedido (nullable), vencimento, pagamento (date|null), valor, valor_pago, desconto, valor_multa, valor_juros, acrescimo, percentuais e dias de juros, forma_pagamento, referente. **Não há campo status**, então ele é derivado: pago (pagamento != null e valor_pago ≥ valor − desconto), parcial, vencido (vencimento < hoje e sem pagamento), a vencer. Isso precisa ser validado com dados reais.

### A7. Importação histórica
- GET sem `alterado_apos` retorna **todos** os registros (ativos e excluídos), paginados via `href_proxima_pagina` (null = fim). Não há filtro por data de emissão nem tamanho de página documentado. O histórico depende do que a conta mantém, então o volume real será medido na primeira importação.

### A8. Limitações
- 20.000 req/dia por token_pedidook (todas as operações; erro 42 quando excede).
- Fuso de `ultima_alteracao` não documentado. Assumiremos America/Sao_Paulo e usaremos uma sobreposição de 5 min no cursor.
- Associações cliente↔vendedor custam N requisições (1 por cliente). São sincronizadas em lote com orçamento diário e só para clientes alterados.
- Erros vêm em `{"erros":[{codigo, mensagem}]}`.

### A9. Mapeamento API → tabelas
customers←clientes (endereço principal achatado + jsonb do bruto) · customer_sellers←clientes/{id}/vendedores · products←produtos (sku=codigo, barcode=codigo_barra, sale_price=venda, purchase_cost=custo, current_stock=estoque) · sellers←vendedores · suppliers←fornecedores · orders←pedidos (order_date=emissao, net_amount calculado) · order_items←pedidos.itens (unit_price=preco_liquido, unit_cost_snapshot=preco_custo) · receivables←cobrancas · payment_conditions←condicoes_pagamento · price_tables←tabelas_preco. Toda tabela guarda `pedidook_id`, `pedidook_updated_at`, `deleted_in_source`, `raw jsonb`.

### A10. Indicadores seguros
Faturamento por período/vendedor/cliente/produto/categoria, nº de pedidos, ticket médio, margem bruta por item (custo histórico), metas e projeções, recência e frequência de clientes, curva de vendas por SKU, cobertura com estoque atual, a receber / recebido / vencido.

### A11. Indicadores que dependem de informação adicional
Prazo de entrega e compras pendentes (config manual), histórico de estoque antes do 1º snapshot (inexistente), lucro líquido e fluxo de caixa (sem despesas), devoluções reais (só via "troca"), novos clientes antes do histórico disponível, impostos, comissões e frete no preço mínimo.

