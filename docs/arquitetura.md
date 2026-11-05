# Arquitetura: Fase 1

## Camadas
```
Next.js (App Router) ─ páginas (RSC) + rotas /api (validação Zod, RBAC, rate limit)
   │
   ├─ lib/auth        Supabase Auth (sessão) + RBAC puro (rbac.ts)
   ├─ lib/queries     consultas de negócio (faturamento, metas, saúde da sync)
   ├─ lib/metrics     fórmulas puras e testadas
   ├─ lib/pedidook    PedidoOK Integration Service (somente GET)
   │     client.ts    HTTP + retry + paginação segura + orçamento diário
   │     schemas.ts   Zod fiel à documentação
   │     mappers.ts   API → linhas do banco
   │     resources.ts registro de recursos + upsert idempotente + ligação de FKs
   │     sync.ts      motor: lease, retomada por página, cursor incremental
   └─ lib/db          Drizzle + postgres-js → PostgreSQL do Supabase (transaction pooler)
```

## Sincronização
- **Cron**: a Vercel chama `/api/cron/sync` a cada 5 min. A rota executa só os recursos cujo intervalo (`sync.intervals` em `app_settings`) venceu, ou que têm uma execução pendente. Os intervalos podem ser ajustados sem novo deploy.
- **Lease**: `sync_cursors.locked_until` garante uma execução por recurso, inclusive entre instâncias serverless diferentes.
- **Retomada**: cada página é gravada numa transação junto com `next_page_url` e `last_page`. Se o tempo acabar (cerca de 45 s por invocação) ou ocorrer um erro, a próxima chamada continua da página seguinte.
- **Cursor incremental**:
  - `source_watermark` guarda o maior `ultima_alteracao` processado, no relógio da fonte e sem fuso.
  - Ele só avança ao final de uma execução bem-sucedida.
  - Ao avançar, é recuado pela duração da execução. A consulta seguinte ainda subtrai `sync.overlapMinutes` (5 min).
- **Idempotência**: upsert por `pedidook_id`. Os itens do pedido usam `(order_id, product_pedidook_id)`. Itens que somem do pedido são marcados `deleted_in_source`, nunca apagados.
- **Orçamento**: cada requisição incrementa `api_request_counters`. A execução para ao passar de `sync.dailyRequestBudget` (18.000, abaixo do limite oficial de 20.000).
- **Associações cliente × vendedor**: custam 1 requisição por cliente. São lidas em lotes (`sync.customerSellersPerRun`), primeiro para clientes alterados e depois em releitura periódica (`sync.customerSellersRefreshDays`).
- **Estoque**: um snapshot diário é gravado após cada sincronização de produtos. A API não fornece histórico de estoque.

## Segurança
- **Supabase/RLS**: todas as tabelas do schema `public` têm RLS ligado e nenhuma política (migration `0001_enable_rls`). A API REST pública do Supabase (anon key) não lê nem grava nada. O servidor conecta pela `DATABASE_URL` como dono das tabelas. Toda tabela nova precisa de `ENABLE ROW LEVEL SECURITY`; o teste `tests/security.test.ts` garante isso.
- Os tokens do PedidoOK e a service role do Supabase ficam apenas no servidor (`lib/env.ts`). A paginação recusa URLs fora de `api.pedidook.com.br`, para que os tokens nunca sejam enviados a outro domínio.
- Toda rota `/api` passa por `apiRoute()`, que faz autenticação, RBAC, rate limit e trata erros. O escopo do vendedor é forçado no backend (`scopeSellerId`).
- `audit_logs` registra criação e edição de metas e usuários e os disparos de sincronização.
- O rate limit atual fica em memória, por instância. Na Fase 7 ele deve ir para um armazenamento compartilhado.

## Limitações conhecidas (Fase 1)
- O fuso de `ultima_alteracao` não é documentado. Por isso é tratado como relógio da fonte, sem conversão.
- O cálculo do total do pedido e o status das cobranças precisam ser validados contra relatórios oficiais.
- No plano Hobby da Vercel, crons rodam no máximo uma vez por dia. Para a frequência de 5 min é preciso o plano Pro ou um agendador externo.
