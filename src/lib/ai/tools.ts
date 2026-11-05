/**
 * Ferramentas internas do Pet Intelligence AI (spec §15).
 *
 * - Neutras em relação ao provedor: Claude e OpenAI recebem as MESMAS definições.
 * - A IA nunca executa SQL: cada ferramenta chama um serviço do backend já usado
 *   pelas telas, que aplica o RBAC (ex.: VENDEDOR só vê os próprios dados).
 * - Só são oferecidas ao modelo as ferramentas que o perfil do usuário pode usar;
 *   mesmo assim, cada execução revalida a permissão.
 * - Todo resultado traz `periodo` e `fonte`, para a resposta citar de onde veio o número.
 */
import "server-only";
import { z } from "zod";
import { assertCan, can, HttpError, type Permission } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { customerDetail, customersPage } from "@/lib/customers-service";
import { dashboardOverview, dashboardPerformance, dashboardSales, dashboardTopProducts, resolveScope } from "@/lib/dashboard-service";
import type { Database } from "@/lib/db/types";
import { goalsForUser } from "@/lib/goals-service";
import { CLASS_LABELS } from "@/lib/metrics/customers";
import { PERIOD_PRESETS } from "@/lib/periods";
import { listPromotions } from "@/lib/queries/promotions";
import { stockPage } from "@/lib/stock-service";

export interface ToolContext {
  db: Database;
  user: SessionUser;
  now: Date;
}

export interface AITool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  permission: Permission;
  input: S;
  run: (ctx: ToolContext, input: z.infer<S>) => Promise<unknown>;
}

const FONTE_PEDIDOS = "Pedidos do PedidoOK (status 'pedido', não excluídos), por data de emissão; valor líquido sem frete.";

const period = z.object({
  periodo: z
    .enum(PERIOD_PRESETS)
    .describe("Período: hoje, 7d, 30d, mes (mês atual), mes_anterior, ano (ano atual) ou personalizado (exige de/ate)."),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Início (AAAA-MM-DD), só com periodo=personalizado."),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fim (AAAA-MM-DD), só com periodo=personalizado."),
});

const r2 = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);

function scopeFor(ctx: ToolContext, p: z.infer<typeof period>, sellerId?: string) {
  return resolveScope(ctx.user, { p: p.periodo, de: p.de, ate: p.ate, vendedor: sellerId }, ctx.now);
}

const define = <S extends z.ZodType>(t: AITool<S>) => t;

export const AI_TOOLS = [
  define({
    name: "get_sales_summary",
    description:
      "Faturamento, número de pedidos, ticket médio e comparação com o período anterior. Para ADMIN/GESTOR também traz lucro bruto estimado e a cobertura de custo, e a contagem de clientes ativos/em risco/inativos. Vendedores recebem só os próprios números.",
    permission: "dashboard:view",
    input: period.extend({ vendedor_id: z.uuid().optional().describe("Filtrar por um vendedor (UUID). Omitir = empresa toda.") }),
    async run(ctx, i) {
      const s = scopeFor(ctx, i, i.vendedor_id);
      const ov = await dashboardOverview(ctx.db, s);
      return {
        periodo: { inicio: s.period.start, fim: s.period.end, descricao: s.period.label },
        periodo_comparacao: s.period.previous,
        escopo: s.sellerId ? "vendedor" : "empresa",
        faturamento: r2(ov.revenue),
        pedidos: ov.orders,
        ticket_medio: r2(ov.averageTicket),
        anterior: { faturamento: r2(ov.previous.revenue), pedidos: ov.previous.orders, ticket_medio: r2(ov.previous.averageTicket) },
        lucro_bruto_estimado: r2(ov.grossProfit),
        margem_bruta_pct: r2(ov.grossMarginPct),
        cobertura_custo_pct: r2(ov.costCoveragePct),
        clientes: { ativos: ov.activeCustomers, em_risco: ov.atRiskCustomers, inativos: ov.inactiveCustomers },
        fonte: FONTE_PEDIDOS,
        observacao:
          ov.grossMarginPct === null
            ? "Margem não disponível para este perfil ou sem custo cadastrado."
            : "Margem calculada só sobre pedidos com custo conhecido; veja cobertura_custo_pct.",
      };
    },
  }),

  define({
    name: "get_sales_evolution",
    description: "Evolução mensal do faturamento e pedidos nos últimos 12 meses até o fim do período (respeita o escopo do vendedor).",
    permission: "dashboard:view",
    input: z.object({ vendedor_id: z.uuid().optional() }),
    async run(ctx, i) {
      const s = scopeFor(ctx, { periodo: "mes" }, i.vendedor_id);
      const { monthly } = await dashboardSales(ctx.db, s);
      return { periodo: { fim: s.period.end, meses: 12 }, escopo: s.sellerId ? "vendedor" : "empresa", meses: monthly, fonte: FONTE_PEDIDOS };
    },
  }),

  define({
    name: "get_seller_performance",
    description: "Ranking de vendedores no período: faturamento, pedidos, ticket médio, clientes atendidos e faturamento do período anterior.",
    permission: "sellers:view_all",
    input: period,
    async run(ctx, i) {
      const s = scopeFor(ctx, i);
      const rows = await dashboardPerformance(ctx.db, s);
      return {
        periodo: { inicio: s.period.start, fim: s.period.end, descricao: s.period.label },
        vendedores: rows.map((r) => ({
          vendedor_id: r.sellerId,
          nome: r.name,
          regiao: r.region,
          faturamento: r2(r.revenue),
          pedidos: r.orders,
          ticket_medio: r2(r.averageTicket),
          clientes: r.customers,
          faturamento_periodo_anterior: r2(r.previousRevenue),
        })),
        fonte: FONTE_PEDIDOS,
      };
    },
  }),

  define({
    name: "get_sales_goals",
    description:
      "Metas do mês com progresso: meta, realizado, % atingido, quanto falta, meta diária necessária e projeção de fechamento. ADMIN/GESTOR veem a meta da empresa e de todos os vendedores; vendedor vê só a própria.",
    permission: "goals:view",
    input: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mês AAAA-MM. Omitir = mês atual.") }),
    async run(ctx, i) {
      const res = await goalsForUser(ctx.db, ctx.user, { month: i.mes, sellerId: ctx.user.role === "VENDEDOR" ? ctx.user.sellerId : null }, ctx.now);
      return {
        periodo: res.period,
        hoje: res.today,
        metas: res.goals,
        fonte: "Metas cadastradas no Pet Intelligence; realizado = " + FONTE_PEDIDOS,
        observacao: res.goals.length === 0 ? "Nenhuma meta cadastrada para este mês." : undefined,
      };
    },
  }),

  define({
    name: "get_customers_to_contact",
    description:
      "Clientes classificados pela frequência individual de compra. Use para 'quem preciso contatar', clientes inativos ou em risco. Classes: em_risco, inativo, novo, recuperado, recorrente, ativo, ou 'oportunidades' (em risco + inativos que mais valem). Vendedor recebe só os clientes dele.",
    permission: "customers:view",
    input: z.object({
      classe: z.enum(["em_risco", "inativo", "novo", "recuperado", "recorrente", "ativo", "oportunidades"]).optional(),
      dias_sem_comprar_min: z.number().int().min(0).max(3650).optional(),
      cidade: z.string().max(60).optional(),
      limite: z.number().int().min(1).max(50).optional().describe("Máximo de clientes retornados (padrão 15)."),
    }),
    async run(ctx, i) {
      const res = await customersPage(ctx.db, ctx.user, { classe: i.classe ?? "oportunidades", dias_min: i.dias_sem_comprar_min, cidade: i.cidade }, ctx.now);
      return {
        periodo: { data_referencia: res.today, historico: "todo o histórico importado (desde 12/2023)" },
        contagem_por_classe: res.counts,
        total_encontrado: res.total,
        clientes: res.rows.slice(0, i.limite ?? 15).map((c) => ({
          cliente_id: c.customerId,
          nome: c.tradeName || c.name,
          cidade: c.city && c.state ? `${c.city}/${c.state}` : c.city,
          telefone: c.phone,
          classe: CLASS_LABELS[c.class],
          ultima_compra: c.lastPurchase,
          dias_sem_comprar: c.daysWithoutBuying,
          intervalo_medio_dias: c.avgIntervalDays,
          proxima_compra_esperada: c.expectedNextPurchase,
          faturamento_total: r2(c.totalRevenue),
          faturamento_mensal_medio: r2(c.monthlyRevenue),
          vendedores: c.sellerNames,
          motivos: c.reasons,
        })),
        fonte: "Classificação do Pet Intelligence sobre os pedidos do PedidoOK (intervalo médio entre compras de cada cliente).",
      };
    },
  }),

  define({
    name: "get_customer_purchase_history",
    description: "Histórico de um cliente: últimos pedidos, produtos que costuma comprar e faturamento mensal. Busque pelo nome (ou parte do nome/CNPJ).",
    permission: "customers:view",
    input: z.object({ busca: z.string().min(2).max(80).describe("Nome, nome fantasia ou CNPJ do cliente.") }),
    async run(ctx, i) {
      const found = await customersPage(ctx.db, ctx.user, { busca: i.busca }, ctx.now);
      if (found.total === 0) return { encontrado: false, mensagem: `Nenhum cliente com compras no seu escopo corresponde a "${i.busca}".` };
      const first = found.rows[0];
      if (!first.customerId) return { encontrado: false, mensagem: "Cliente sem cadastro vinculado." };
      const d = await customerDetail(ctx.db, ctx.user, first.customerId, ctx.now);
      return {
        outros_resultados: found.total > 1 ? found.rows.slice(1, 6).map((c) => c.tradeName || c.name) : [],
        cliente: { nome: d.customer.tradeName || d.customer.name, cidade: d.customer.city, classe: CLASS_LABELS[d.customer.class], ...pickMetrics(d.customer) },
        ultimos_pedidos: d.orders.slice(0, 15),
        produtos_habituais: d.products,
        faturamento_mensal: d.monthly,
        periodo: { data_referencia: d.today, historico: "todo o histórico importado" },
        escopo: d.scopedToSeller ? "apenas pedidos do próprio vendedor" : "todos os pedidos",
        fonte: FONTE_PEDIDOS,
      };
    },
  }),

  define({
    name: "get_product_performance",
    description: "Produtos e categorias mais vendidos no período (quantidade e valor dos itens). Vendedor vê só as próprias vendas.",
    permission: "dashboard:view",
    input: period,
    async run(ctx, i) {
      const s = scopeFor(ctx, i);
      const { products, categories } = await dashboardTopProducts(ctx.db, s);
      return {
        periodo: { inicio: s.period.start, fim: s.period.end, descricao: s.period.label },
        produtos: products.map((p) => ({ nome: p.name, sku: p.sku, categoria: p.category, quantidade: p.quantity, valor_itens: r2(p.itemsAmount) })),
        categorias: categories,
        fonte: "Itens dos pedidos do PedidoOK (valor dos itens antes do desconto em R$ do cabeçalho).",
        observacao: "Margem por produto não é confiável: desde 2025 os produtos estão sem custo cadastrado no PedidoOK.",
      };
    },
  }),

  define({
    name: "get_stock_recommendations",
    description: "Sugestões de compra/reposição, rupturas, excesso e produtos parados, com base no estoque atual e no giro.",
    permission: "stock:view",
    input: z.object({ relatorio: z.enum(["comprar", "ruptura", "excesso", "parados"]).optional() }),
    async run(ctx, i) {
      const res = await stockPage(ctx.db, { relatorio: i.relatorio ?? "comprar" }, ctx.now);
      return {
        periodo: { data_referencia: res.today, historico_dias: res.history.days },
        relatorio: res.report,
        contagens: res.counts,
        itens: res.rows.slice(0, 20).map((r) => ({
          nome: r.name,
          sku: r.sku,
          estoque_atual: r.currentStock,
          media_diaria: r.avgDailyDemand,
          cobertura_dias: r.coverageDays,
          sugestao_qtd: r.suggestedQty,
          status: r.status,
          qualidade: r.quality,
        })),
        fonte: "Estoque atual do cadastro de produtos do PedidoOK + vendas dos pedidos.",
        limitacao:
          "ATENÇÃO: o estoque NÃO é controlado no PedidoOK (muitos produtos com estoque negativo). Trate estas sugestões como indicativas e avise o usuário.",
      };
    },
  }),

  define({
    name: "get_promotion_opportunities",
    description: "Sugestões de promoção pendentes geradas pelo motor de promoções (produto, preço atual e sugerido, motivo, impacto estimado).",
    permission: "promotions:view",
    input: z.object({}),
    async run(ctx) {
      const rows = await listPromotions(ctx.db, { status: "sugerida" });
      return {
        periodo: { data_referencia: ctx.now.toISOString().slice(0, 10) },
        sugestoes: rows.slice(0, 15),
        total: rows.length,
        fonte: "Motor de promoções do Pet Intelligence (sugestões; nunca alteram preços no PedidoOK).",
        limitacao: "As sugestões dependem de custo e estoque, que hoje estão incompletos no PedidoOK.",
      };
    },
  }),
];

function pickMetrics(c: { orders: number; lastPurchase: string | null; daysWithoutBuying: number | null; avgIntervalDays: number | null; totalRevenue: number; averageTicket: number | null }) {
  return {
    pedidos: c.orders,
    ultima_compra: c.lastPurchase,
    dias_sem_comprar: c.daysWithoutBuying,
    intervalo_medio_dias: c.avgIntervalDays,
    faturamento_total: r2(c.totalRevenue),
    ticket_medio: r2(c.averageTicket),
  };
}

/** Ferramentas que o perfil pode usar (VENDEDOR sem vendedor vinculado não recebe as de dados próprios). */
export function toolsFor(user: SessionUser): AITool[] {
  return (AI_TOOLS as AITool[]).filter((t) => can(user, t.permission));
}

export function toolJsonSchema(t: AITool): Record<string, unknown> {
  const schema = z.toJSONSchema(t.input, { target: "draft-7" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** Executa uma ferramenta validando entrada e permissão; erros viram resultado legível para o modelo. */
export async function executeTool(ctx: ToolContext, name: string, rawInput: unknown): Promise<{ ok: boolean; result: unknown }> {
  const tool = (AI_TOOLS as AITool[]).find((t) => t.name === name);
  if (!tool) return { ok: false, result: { erro: `Ferramenta desconhecida: ${name}` } };
  try {
    assertCan(ctx.user, tool.permission);
    const input = tool.input.parse(rawInput ?? {});
    return { ok: true, result: await tool.run(ctx, input) };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, result: { erro: e.message } };
    if (e instanceof z.ZodError) return { ok: false, result: { erro: "Parâmetros inválidos.", detalhes: e.issues.map((x) => `${x.path.join(".")}: ${x.message}`) } };
    console.error("[ai] erro na ferramenta", name, e instanceof Error ? e.message : e);
    return { ok: false, result: { erro: "Falha ao consultar os dados." } };
  }
}
