# PET INTELLIGENCE
## Especificação técnica e funcional — Versão 1.0

**Tipo:** Sistema web de inteligência gerencial  
**Segmento:** Distribuidora de produtos pet  
**Fonte de dados:** PedidoOK API  
**Usuários:** Administração e vendedores, com permissões diferentes  
**Histórico:** Importação de todo o histórico disponibilizado pela API  
**IA:** Claude API e OpenAI API, selecionáveis  
**Modo inicial:** Somente leitura no PedidoOK

---

# 1. VISÃO DO PRODUTO

Desenvolver uma plataforma web independente para transformar os dados operacionais da distribuidora em informações gerenciais, análises, previsões e recomendações.

O sistema deverá acompanhar automaticamente as operações da empresa e ajudar a administração a responder:

- Quanto estamos vendendo?
- Estamos atingindo nossas metas?
- Qual vendedor está performando melhor?
- Quais produtos precisam ser comprados?
- Quais produtos estão parados?
- Quais clientes estão deixando de comprar?
- Quais promoções podem aumentar o giro?
- Quais produtos apresentam maior rentabilidade?
- Como está o fluxo financeiro?
- Qual é a previsão de faturamento?
- Quanto devemos comprar dos fornecedores?

O sistema não será um ERP substituto. Será uma camada de inteligência independente conectada ao PedidoOK.

# 2. STACK TECNOLÓGICA

Utilizar preferencialmente as seguintes tecnologias:

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js + React |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS |
| Componentes | shadcn/ui |
| Gráficos | Recharts |
| Backend | Next.js API Routes |
| Banco de dados | Neon PostgreSQL |
| ORM | Drizzle ORM |
| Autenticação | Supabase Auth |
| IA | Anthropic Claude API + OpenAI API |
| Hospedagem | Vercel |
| Agendamentos | Cron Jobs |
| Validação | Zod |

Arquitetura preparada para separar frontend, backend, sincronização e serviços de inteligência futuramente.

# 3. IDENTIDADE E INTERFACE

Criar uma interface premium, moderna, minimalista e profissional.

Referências de estilo:
- Linear
- Stripe Dashboard
- Vercel Dashboard
- Ramp

Características:
- Layout responsivo.
- Sidebar lateral.
- Navegação intuitiva.
- Cards de indicadores.
- Gráficos limpos.
- Tabelas com filtros.
- Busca global.
- Estados de carregamento.
- Indicadores de sincronização.
- Alertas e notificações.

Evitar excesso de cores, sombras e elementos decorativos.

A interface deverá priorizar leitura rápida e tomada de decisão.

Idioma: português brasileiro.

Moeda: BRL (R$).

Fuso horário: America/Sao_Paulo.

Formato de datas: DD/MM/AAAA.

# 4. CONTROLE DE ACESSO

Implementar RBAC (Role-Based Access Control).

Criar inicialmente três papéis:

## ADMIN
Acesso completo:
- Dashboard geral.
- Financeiro.
- Metas da empresa.
- Metas dos vendedores.
- Produtos.
- Estoque.
- Clientes.
- Fornecedores.
- Relatórios.
- Configurações.
- Integração PedidoOK.
- Configurações de IA.
- Gerenciamento de usuários.

## GESTOR
Acesso:
- Dashboard comercial.
- Metas.
- Desempenho de vendedores.
- Clientes.
- Produtos.
- Estoque.
- Relatórios autorizados.
- Recomendações da IA.

Não pode:
- Alterar credenciais de integração.
- Gerenciar administradores.
- Modificar configurações críticas.

## VENDEDOR
Acesso restrito:
- Seu próprio faturamento.
- Sua própria meta.
- Seu desempenho.
- Seus clientes vinculados.
- Histórico de pedidos dos seus clientes.
- Clientes que precisam de contato.
- Recomendações comerciais destinadas a ele.

Não pode visualizar:
- Faturamento de outros vendedores.
- Margem geral da empresa.
- Fluxo de caixa.
- Custos de aquisição.
- Dados financeiros administrativos.
- Configurações.

Toda autorização deve ser validada no backend, não apenas escondida na interface.

# 5. INTEGRAÇÃO COM PEDIDOOK

Criar um módulo independente chamado PedidoOK Integration Service.

Documentação oficial:
https://docs.api.pedidook.com.br/

API base:
https://api.pedidook.com.br/v1/

Autenticação por headers:

token_parceiro: TOKEN_DO_PARCEIRO

token_pedidook: TOKEN_DA_CONTA

Content-Type: application/json

Armazenar credenciais em variáveis de ambiente:

PEDIDOOK_TOKEN_PARCEIRO=
PEDIDOOK_TOKEN=

Nunca expor esses tokens no frontend.

## Recursos a integrar

Prioridade alta:

- /clientes/
- /produtos/
- /vendedores/
- /fornecedores/
- /pedidos/
- /cobrancas/

Prioridade complementar:

- /tabelas_preco/
- /condicoes_pagamento/

Inspecionar a documentação de cada recurso antes de implementar.

Não inventar campos, relacionamentos ou endpoints.

## Estratégia de sincronização

Implementar dois processos:

### A. Importação histórica inicial

1. Consultar os registros disponíveis em cada recurso.
2. Percorrer todas as páginas.
3. Utilizar href_proxima_pagina para continuar a paginação.
4. Persistir os registros no PostgreSQL.
5. Preservar os identificadores originais.
6. Registrar data e hora da importação.
7. Validar quantidade de registros importados.
8. Registrar erros e permitir retomada.

Importar todo o histórico que a API efetivamente disponibilizar.

Não presumir que o PedidoOK mantém histórico ilimitado.

### B. Sincronização incremental

Utilizar o parâmetro alterado_apos quando disponível.

Cada recurso deverá possuir seu próprio cursor de sincronização.

Exemplo:

- Última sincronização de produtos.
- Última sincronização de pedidos.
- Última sincronização de clientes.
- Última sincronização de cobranças.

A sincronização deve:

- Buscar registros alterados.
- Percorrer todas as páginas.
- Atualizar registros existentes.
- Inserir novos registros.
- Preservar registros excluídos ou cancelados como histórico, conforme os dados disponíveis.
- Atualizar o cursor somente após a conclusão bem-sucedida.
- Ser idempotente.
- Ter mecanismo de retry.
- Registrar logs.

Implementar uma pequena margem de sobreposição temporal no cursor para reduzir risco de perder alterações por diferenças de precisão de timestamp.

Respeitar o limite documentado de 20.000 requisições diárias por token_pedidook.

Criar um painel de saúde da integração.

## Frequência

Configuração inicial sugerida:

- Pedidos: a cada 5 minutos.
- Cobranças: a cada 15 minutos.
- Clientes: a cada 30 minutos.
- Produtos: a cada 30 minutos.
- Vendedores: a cada 60 minutos.
- Fornecedores: a cada 60 minutos.

Frequências ajustáveis.

A importação histórica deverá rodar separadamente e com controle de concorrência.

# 6. MODELAGEM DO BANCO DE DADOS

Utilizar PostgreSQL no Neon.

Todas as tabelas operacionais deverão estar preparadas para preservar o ID original do PedidoOK.

## Tabelas principais

### users
- id
- name
- email
- password/auth reference
- role
- seller_id (nullable)
- active
- created_at
- updated_at

### sellers
- id
- pedidook_id
- name
- region
- active
- created_at
- updated_at

### customers
- id
- pedidook_id
- corporate_name
- trade_name
- cnpj
- phone
- email
- address
- seller_id
- last_order_date
- total_orders
- total_revenue
- active
- created_at
- updated_at

### products
- id
- pedidook_id
- sku
- barcode
- name
- brand
- category
- packaging
- sale_price
- purchase_cost
- current_stock
- minimum_stock
- supplier_id
- active
- created_at
- updated_at

### suppliers
- id
- pedidook_id
- name
- cnpj
- phone
- active

### orders
- id
- pedidook_id
- customer_id
- seller_id
- order_date
- status
- gross_amount
- discount_amount
- net_amount
- payment_condition_id
- source
- created_at
- updated_at

### order_items
- id
- order_id
- product_id
- quantity
- unit_price
- unit_cost_snapshot
- discount
- total_amount
- gross_margin

Preservar os dados históricos dos itens. O custo registrado no momento da venda deverá ser mantido quando disponível, sem ser substituído pelo custo atual do produto.

### receivables
- id
- pedidook_id
- customer_id
- order_id
- due_date
- payment_date
- amount
- amount_paid
- discount
- interest
- payment_method
- status
- created_at
- updated_at

### sales_goals
- id
- seller_id (nullable)
- period_start
- period_end
- target_revenue
- target_orders
- target_new_customers
- created_by
- created_at

Quando seller_id for nulo, a meta será da empresa.

### stock_snapshots
- id
- product_id
- quantity
- snapshot_date
- source

### stock_movements
- id
- product_id
- movement_type
- quantity
- reference_type
- reference_id
- movement_date
- source
- created_at

Não inventar movimentações históricas caso a API não as disponibilize.

### promotions
- id
- product_id
- promotion_type
- suggested_price
- minimum_margin
- estimated_quantity
- estimated_revenue
- estimated_profit
- reasoning
- status
- created_at

### recommendations
- id
- category
- title
- description
- priority
- impact_estimate
- related_product_id
- related_customer_id
- related_seller_id
- status
- created_at
- expires_at

### sync_logs
- id
- resource
- started_at
- finished_at
- records_read
- records_created
- records_updated
- errors
- status

### sync_cursors
- id
- resource
- last_successful_sync
- last_page
- status
- updated_at

### audit_logs
- id
- user_id
- action
- entity
- entity_id
- metadata
- created_at

### ai_conversations
- id
- user_id
- provider
- model
- created_at

### ai_messages
- id
- conversation_id
- role
- content
- created_at

Criar índices para:
- pedidook_id
- order_date
- customer_id
- seller_id
- product_id
- due_date
- SKU
- status

Utilizar chaves estrangeiras, restrições de unicidade e transações.

Armazenar valores monetários em NUMERIC/DECIMAL, nunca FLOAT.

Considerar UUIDs internos e IDs do PedidoOK como identificadores externos.

# 7. MÓDULO DASHBOARD GERAL

Criar a página inicial com:

Indicadores:
- Faturamento do mês.
- Meta mensal.
- Percentual da meta atingido.
- Pedidos realizados.
- Ticket médio.
- Lucro bruto estimado.
- Margem bruta.
- Clientes ativos.
- Clientes inativos.
- Produtos com estoque crítico.

Gráficos:
- Faturamento diário.
- Faturamento mensal.
- Comparativo com mês anterior.
- Desempenho por vendedor.
- Produtos mais vendidos.
- Categorias mais vendidas.
- Evolução do ticket médio.

Adicionar filtros:
- Hoje.
- Últimos 7 dias.
- Últimos 30 dias.
- Mês atual.
- Mês anterior.
- Ano atual.
- Período personalizado.

Toda métrica deve permitir visualizar os registros que a compõem.

# 8. MÓDULO DE METAS

Permitir que administradores criem metas:

- Mensais da empresa.
- Mensais por vendedor.
- Semanais.
- Metas de novos clientes.
- Metas de quantidade de pedidos.

Cálculos:

Percentual atingido:

(realizado / meta) * 100

Valor restante:

meta - realizado

Meta diária necessária:

(meta - realizado) / dias restantes

Projeção de fechamento:

(faturamento acumulado / dias decorridos) * dias totais

Considerar dias úteis como opção de cálculo.

Não dividir por zero. Diferenciar dias corridos e dias úteis.

Criar ranking de vendedores.

A projeção deve ser identificada como estimativa, não como faturamento confirmado.

# 9. MÓDULO DE VENDEDORES

Criar perfil individual para cada vendedor.

Exibir:
- Faturamento.
- Meta.
- Percentual atingido.
- Número de pedidos.
- Ticket médio.
- Clientes atendidos.
- Novos clientes.
- Clientes recuperados.
- Evolução mensal.
- Produtos mais vendidos.
- Clientes sem recompra.

Permitir comparar períodos.

Atribuir pedidos ao vendedor conforme a informação oficial do PedidoOK.

Não atribuir vendas a um vendedor por inferência quando o campo não estiver disponível.

# 10. MÓDULO DE INTELIGÊNCIA DE CLIENTES

Classificar automaticamente os clientes.

Categorias configuráveis:

- Ativo.
- Recorrente.
- Em risco.
- Inativo.
- Recuperado.
- Novo.

Utilizar a frequência histórica individual como referência.

Criar inicialmente regras configuráveis:

- Em risco: cliente acima de 1,5 vez seu intervalo médio de recompra.
- Inativo: cliente acima de 2,5 vezes seu intervalo médio de recompra.
- Novo: cliente com primeira compra registrada nos últimos 30 dias.
- Recuperado: cliente que voltou a comprar após período de inatividade.

Clientes sem histórico suficiente deverão utilizar limites gerais configuráveis.

Mostrar:

- Última compra.
- Dias sem comprar.
- Média de dias entre compras.
- Ticket médio histórico.
- Faturamento acumulado.
- Produtos que costuma comprar.
- Vendedor responsável.
- Histórico de pedidos.

Criar lista de oportunidades comerciais.

Permitir filtros por vendedor, cidade, região, faturamento e dias sem comprar.

# 11. MÓDULO DE INTELIGÊNCIA DE ESTOQUE

Criar análise por SKU.

Indicadores:

- Estoque atual.
- Média de vendas diária.
- Vendas nos últimos 7, 30, 60 e 90 dias.
- Cobertura de estoque.
- Estoque de segurança.
- Ponto de reposição.
- Quantidade sugerida de compra.
- Custo estimado da reposição.
- Fornecedor.
- Dias de estoque parado.

Fórmulas:

Demanda média diária:

quantidade vendida no período / dias analisados

Cobertura:

estoque disponível / demanda média diária

Ponto de reposição:

demanda média diária * prazo de entrega + estoque de segurança

Estoque de segurança:

demanda média diária * dias de segurança

Quantidade sugerida:

máximo(0, estoque desejado - estoque disponível - compras pendentes)

Estoque desejado:

demanda média diária * (prazo de entrega + intervalo de revisão) + estoque de segurança

Considerar:
- Compras pendentes.
- Pedidos de venda ainda não atendidos, quando identificáveis.
- Sazonalidade.
- Produtos com baixa movimentação.
- Estoque mínimo cadastrado.
- Prazo de entrega dos fornecedores.

Caso prazo de entrega não esteja disponível, permitir configuração manual por fornecedor.

Não gerar sugestões confiáveis quando o histórico for insuficiente. Identificar a qualidade da estimativa.

Criar relatórios:

- Produtos para comprar.
- Produtos em ruptura.
- Produtos com excesso.
- Produtos parados.
- Produtos com maior giro.
- Produtos com maior investimento em estoque.

# 12. MÓDULO DE PROMOÇÕES

Criar um motor de recomendações comerciais.

Identificar:
- Produtos parados.
- Produtos com excesso de estoque.
- Produtos com queda de vendas.
- Produtos com margem elevada.
- Produtos frequentemente vendidos juntos.
- Produtos com oportunidades de venda casada.

Cada sugestão deverá apresentar:

- Produto.
- Situação identificada.
- Estoque atual.
- Custo.
- Preço atual.
- Preço sugerido.
- Margem estimada.
- Quantidade potencial.
- Justificativa.
- Impacto financeiro estimado.

Calcular margem:

(preço de venda - custo) / preço de venda * 100

Calcular preço mínimo para margem desejada:

custo / (1 - margem desejada)

Essa fórmula é uma simplificação e deverá ser ajustada para incorporar impostos, comissões, frete e outros custos variáveis.

Criar parâmetros administrativos:
- Margem mínima permitida.
- Desconto máximo.
- Estoque mínimo protegido.
- Quantidade mínima por pedido.

As promoções serão sugestões, nunca alterações automáticas nos preços do PedidoOK.

# 13. MÓDULO FINANCEIRO

Exibir:

- Total a receber.
- Total recebido.
- Cobranças vencidas.
- Cobranças a vencer.
- Clientes inadimplentes.
- Prazo médio de recebimento, quando houver dados suficientes.
- Evolução de recebimentos.
- Previsão de recebimentos.

Utilizar os dados de cobranças do PedidoOK.

Valores:

Saldo pendente:

valor - valor_pago - descontos aplicáveis

A regra exata deverá respeitar os campos de cobrança e a forma como o PedidoOK registra pagamentos.

Diferenciar:
- Faturamento de pedidos.
- Valor cobrado.
- Valor efetivamente pago.
- Valor vencido.

Não chamar faturamento de lucro líquido.

Não apresentar fluxo de caixa completo se não houver dados de despesas, pagamentos a fornecedores e movimentações bancárias.

Criar futuramente integração ou importação adicional para despesas e contas a pagar.

# 14. MÓDULO DE RELATÓRIOS

Permitir exportar CSV e PDF.

Relatórios:
- Vendas por período.
- Vendas por vendedor.
- Vendas por produto.
- Vendas por cliente.
- Clientes inativos.
- Metas.
- Estoque.
- Sugestões de compra.
- Rentabilidade.
- Cobranças.
- Recomendações.

Permitir filtros e períodos personalizados.

# 15. MÓDULO DE INTELIGÊNCIA ARTIFICIAL

Criar um assistente chamado Pet Intelligence AI.

Deverá suportar:

- Anthropic Claude API.
- OpenAI API.

Criar uma camada de abstração AIProvider.

Implementar:
- ClaudeProvider.
- OpenAIProvider.

Permitir selecionar o provedor nas configurações administrativas.

Não duplicar regras de negócio para cada provedor.

## Funções da IA

Responder perguntas sobre a empresa:

- Qual foi nosso faturamento este mês?
- Qual vendedor está mais distante da meta?
- Quais clientes precisam ser contatados?
- Quais produtos precisamos comprar?
- Qual produto apresenta maior margem?
- Qual foi a evolução das vendas?
- Quais produtos poderiam entrar em promoção?
- Como podemos aumentar o ticket médio?

A IA deve consultar dados reais do PostgreSQL por meio de funções controladas.

Não deve inventar números.

Toda resposta quantitativa deverá utilizar consultas ou indicadores calculados pelo backend.

Incluir período analisado e fonte dos dados.

Se não houver dados suficientes, informar a limitação.

## Ferramentas internas da IA

Implementar funções como:

get_sales_summary(period)
get_seller_performance(period)
get_sales_goals(period)
get_inactive_customers(days)
get_product_performance(period)
get_stock_recommendations()
get_customer_purchase_history(customer_id)
get_receivables_summary(period)
get_promotion_opportunities()
get_revenue_forecast(period)

A IA não poderá executar SQL arbitrário.

Implementar controle de acesso por função e papel de usuário.

Não permitir que vendedores consultem dados administrativos restritos por meio do assistente.

# 16. ENDPOINTS INTERNOS DO PET INTELLIGENCE

Criar API própria, independente da API do PedidoOK.

## Dashboard

GET /api/dashboard/overview

GET /api/dashboard/sales

GET /api/dashboard/performance

GET /api/dashboard/top-products

## Metas

GET /api/goals

POST /api/goals

PATCH /api/goals/:id

GET /api/goals/progress

## Vendedores

GET /api/sellers

GET /api/sellers/:id/performance

GET /api/sellers/:id/customers

## Clientes

GET /api/customers

GET /api/customers/inactive

GET /api/customers/at-risk

GET /api/customers/:id/history

GET /api/customers/:id/metrics

## Produtos

GET /api/products

GET /api/products/:id/performance

GET /api/products/stock

GET /api/products/slow-moving

GET /api/products/replenishment

## Promoções

GET /api/promotions/suggestions

POST /api/promotions/:id/approve

POST /api/promotions/:id/reject

## Financeiro

GET /api/finance/receivables

GET /api/finance/overdue

GET /api/finance/summary

## IA

POST /api/ai/chat

GET /api/ai/providers

PATCH /api/ai/settings

## Integração

GET /api/integrations/pedidook/status

POST /api/integrations/pedidook/sync

GET /api/integrations/pedidook/logs

GET /api/integrations/pedidook/resources

Todas as rotas deverão validar autenticação, autorização, parâmetros e limites de requisição.

# 17. SEGURANÇA E LGPD

Implementar:

- Autenticação segura.
- RBAC.
- Proteção de credenciais.
- HTTPS.
- Validação de entradas.
- Proteção contra SQL injection.
- Rate limiting.
- Logs de auditoria.
- Controle de sessões.
- Backup do banco.
- Política de retenção.
- Isolamento de dados por usuário e função.

Dados de clientes e CNPJs deverão ser tratados conforme a LGPD.

Não enviar dados pessoais desnecessários aos provedores de IA.

Preferir informações agregadas e identificadores internos.

Não armazenar tokens em logs.

# 18. EXPERIÊNCIA DE SINCRONIZAÇÃO

Criar página de configuração da integração.

Mostrar:

- Status da conexão.
- Última sincronização.
- Próxima sincronização.
- Recursos sincronizados.
- Quantidade de registros.
- Erros recentes.
- Histórico de importações.
- Botão de sincronização manual para administradores.

Criar alertas quando a sincronização falhar.

O sistema deverá diferenciar:
- Dados atualizados.
- Dados parcialmente sincronizados.
- Dados desatualizados.
- Dados indisponíveis.

Nunca apresentar dados antigos como se fossem atualizados em tempo real.

# 19. FASES DE DESENVOLVIMENTO

Desenvolver nesta ordem.

## FASE 0 — Auditoria técnica

Antes de programar:
1. Ler toda a documentação da API PedidoOK.
2. Mapear os endpoints.
3. Conferir a estrutura JSON dos pedidos.
4. Identificar os itens dos pedidos.
5. Identificar os campos de vendedor.
6. Identificar status, cancelamentos e devoluções.
7. Conferir dados históricos disponíveis.
8. Validar cobranças e pagamentos.
9. Apresentar relatório de viabilidade.

Não avançar para os cálculos sem validar os campos reais.

## FASE 1 — Fundação

- Criar projeto.
- Configurar Next.js.
- Configurar Neon.
- Configurar autenticação.
- Criar RBAC.
- Criar banco.
- Criar interface base.
- Criar integração PedidoOK.
- Implementar importação histórica.

Critério de conclusão: dados reais importados e conferidos.

## FASE 2 — Dashboard e metas

- Dashboard.
- Indicadores.
- Gráficos.
- Metas da empresa.
- Metas individuais.
- Ranking.

Critério de conclusão: números conferidos com o PedidoOK.

## FASE 3 — Estoque

- Giro.
- Cobertura.
- Ponto de reposição.
- Sugestões de compra.
- Produtos parados.
- Excesso de estoque.

Critério de conclusão: sugestões reproduzíveis e explicáveis.

## FASE 4 — Inteligência comercial

- Clientes inativos.
- Clientes em risco.
- Histórico de recompra.
- Promoções.
- Oportunidades.
- Desempenho comercial.

Critério de conclusão: recomendações com dados rastreáveis.

## FASE 5 — Financeiro

- Cobranças.
- Recebimentos.
- Inadimplência.
- Previsões.
- Rentabilidade.

Critério de conclusão: separação correta entre faturamento, recebimentos e lucro.

## FASE 6 — IA

- Integração Claude.
- Integração OpenAI.
- Seletor de provedor.
- Ferramentas de consulta.
- Controle de permissões.
- Histórico de conversas.
- Respostas com fontes e períodos.

Critério de conclusão: IA respondendo perguntas com dados reais e verificáveis.

## FASE 7 — Produção

- Testes.
- Segurança.
- Monitoramento.
- Backup.
- Otimização.
- Documentação.
- Deploy.

# 20. TESTES OBRIGATÓRIOS

Criar testes automatizados para:

- Cálculo de faturamento.
- Cálculo de margem.
- Metas.
- Projeções.
- Estoque.
- Clientes inativos.
- Pagamentos.
- Pedidos cancelados.
- Duplicidade de importação.
- Paginação.
- Sincronização incremental.
- Permissões.
- Consultas da IA.

Criar testes de comparação com relatórios oficiais do PedidoOK.

Os valores do sistema devem coincidir com a fonte, respeitadas as definições de cada indicador.

# 21. DIRETRIZES DE ENGENHARIA

1. Não construir tudo de uma vez.
2. Não criar dados fictícios como se fossem reais.
3. Não inventar endpoints da API.
4. Não duplicar registros durante sincronização.
5. Não alterar dados do PedidoOK na primeira versão.
6. Não misturar faturamento com recebimento.
7. Não calcular lucro líquido sem despesas e demais custos.
8. Não substituir custos históricos por custos atuais.
9. Não expor informações administrativas para vendedores.
10. Não permitir que a IA invente indicadores.
11. Utilizar migrations para alterações de banco.
12. Manter código modular e tipado.
13. Documentar fórmulas de todos os indicadores.
14. Criar logs e tratamento de erros.
15. Fazer deploy de cada fase funcional.

# 22. PRIMEIRA TAREFA DO CLAUDE CODE

Não comece implementando todos os módulos.

Sua primeira tarefa será realizar uma auditoria completa da documentação da API PedidoOK.

Entregue:

1. Lista de endpoints disponíveis.
2. Estrutura real dos objetos retornados.
3. Estrutura dos pedidos e itens.
4. Campos disponíveis para vendedor.
5. Campos disponíveis para estoque.
6. Dados de cobranças e pagamentos.
7. Possibilidades de importação histórica.
8. Limitações da API.
9. Mapeamento entre os dados da API e as tabelas propostas.
10. Indicadores que podem ser calculados com segurança.
11. Indicadores que dependem de informações adicionais.

Depois da auditoria, apresente a arquitetura técnica detalhada da Fase 1.

Aguarde aprovação antes de começar a implementação.

**RESULTADO ESPERADO:**

Uma plataforma de inteligência gerencial capaz de transformar os dados da distribuidora em decisões comerciais, financeiras e operacionais, com dados confiáveis, histórico preservado, controle de acesso e inteligência artificial integrada.



DOCUMENTAÇÃO DE API PEDIDOOK: docs.api.pedidook.com.br