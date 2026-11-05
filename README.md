# Matilha Pet Intelligence

Camada de inteligência gerencial para a distribuidora, conectada ao **PedidoOK em modo somente leitura**.
Especificação completa: [matilha.md](matilha.md).

**Fase atual: Fase 1 (fundação)**, com a barra de meta já ligada às metas. Inclui:
- auditoria da API ([docs/auditoria-pedidook.md](docs/auditoria-pedidook.md));
- banco de dados, autenticação e RBAC;
- sincronização (importação histórica e incremental) e painel da integração;
- metas, com a barra animada do cachorro.

Outros documentos: [docs/arquitetura.md](docs/arquitetura.md) e [docs/formulas.md](docs/formulas.md).

## Stack
Next.js 15 · TypeScript · Tailwind v4 · Drizzle + Supabase (PostgreSQL + Auth) · Zod · Vitest (PGlite) · Vercel Cron

## Colocando no ar (passo a passo)

1. **Instale as dependências:** `pnpm install`
2. **Crie as contas e pegue as credenciais.** Copie `.env.example` para `.env.local` e preencha:
   - **Supabase** (https://supabase.com): crie um projeto na região São Paulo (sa-east-1) e guarde a senha do banco.
     - **Banco:** clique em **Connect** → "Transaction pooler" (porta 6543), copie a string para `DATABASE_URL` e troque `[YOUR-PASSWORD]` pela senha.
     - **Auth:** em Project Settings → API, copie a URL, a anon key e a service role key.
     - Em Authentication → Providers, deixe só "Email" ativo.
     - Desative "Allow new users to sign up". Os usuários são criados pelo administrador.
   - **PedidoOK**:
     - `PEDIDOOK_TOKEN_PARCEIRO`: solicite em https://www.pedidook.com.br/api.
     - `PEDIDOOK_TOKEN`: na Plataforma PC, vá em Integrações → seu ERP → Obter token_pedidook.
   - `CRON_SECRET`: qualquer texto aleatório longo.
3. **Crie as tabelas:** `pnpm db:migrate`. Isso também liga o RLS em todas as tabelas, para que a API pública do Supabase não exponha os dados.
4. **Crie o primeiro administrador:** `pnpm seed:admin -- --email voce@empresa.com --name "Seu Nome" --password "senha-com-10+"`
5. **Rode a importação histórica.** Escolha uma das opções:
   - `pnpm sync:full` (sem limite de tempo; recomendado na primeira vez);
   - ou, no sistema, Integração PedidoOK → Importação histórica.
6. **Confira os números.** Compare a contagem de registros e o faturamento de um mês com um relatório oficial do PedidoOK. ⚠ Esse é o critério de conclusão da Fase 1.
7. **Publique na Vercel.** Configure as mesmas variáveis de ambiente.
   - O cron de `vercel.json` está configurado para 1×/dia (09:00 UTC = 06:00 em Brasília), o máximo permitido no plano Hobby.
   - Para a frequência do spec (pedidos a cada 5 min), use uma das opções:
     - no plano Pro, mude o `schedule` para `*/5 * * * *`;
     - ou use um agendador externo chamando `GET /api/cron/sync` com o header `Authorization: Bearer <CRON_SECRET>`.
   - Os intervalos por recurso continuam valendo: cada chamada só sincroniza o que venceu.

Sem credenciais, o sistema abre a página **/configuracao**, que mostra o que falta. Nenhum dado fictício é exibido.

## Comandos
| Comando | O que faz |
|---|---|
| `pnpm dev` | servidor local (http://localhost:3000) |
| `pnpm test` | testes: sincronização, fórmulas e permissões (banco em memória) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | verificações |
| `pnpm db:generate` | gera migration após mudar `src/lib/db/schema.ts` |
| `pnpm sync:incremental -- --only pedidos` | sincroniza recursos específicos |

Em desenvolvimento, **/dev/componentes** mostra a barra de meta com valores de exemplo. Essa página não existe em produção.

## Perfis
| Papel | Acesso |
|---|---|
| Administrador | tudo: metas, integração e usuários |
| Gestor | dashboard da empresa e metas de todos; não altera integração nem usuários |
| Vendedor | só o próprio faturamento e a própria meta; precisa estar vinculado ao vendedor do PedidoOK |
