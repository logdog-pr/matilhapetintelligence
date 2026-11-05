import { Lightbulb, PiggyBank, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ParamsForm, type ParamField } from "@/components/forms/ParamsForm";
import { GenerateButton } from "@/components/promotions/PromotionActions";
import { PromotionCard } from "@/components/promotions/PromotionCard";
import { Kpi } from "@/components/ui/Kpi";
import { CardContent, EmptyState, PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PROMOTION_LABELS, type PromotionType } from "@/lib/metrics/promotions";
import { listPromotions, promotionTotals, type PromotionStatus } from "@/lib/queries/promotions";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Promoções" };

const TYPES = Object.keys(PROMOTION_LABELS) as PromotionType[];
const query = z.object({
  status: z.enum(["sugerida", "aprovada", "rejeitada"]).optional(),
  tipo: z.enum(TYPES as [PromotionType, ...PromotionType[]]).optional(),
});

const FIELDS: ParamField[] = [
  { key: "minMarginPct", label: "Margem mínima permitida (%)", hint: "nenhum preço sugerido fica abaixo", step: 0.5 },
  { key: "maxDiscountPct", label: "Desconto máximo (%)", step: 0.5 },
  { key: "protectedMinStock", label: "Estoque mínimo protegido (un.)", hint: "além do mínimo cadastrado" },
  { key: "minOrderQty", label: "Quantidade mínima por pedido" },
  { key: "highMarginPct", label: "Margem elevada a partir de (%)", step: 0.5 },
  { key: "fallingDropPct", label: "Queda de vendas a partir de (%)" },
  { key: "fallingMinUnits", label: "Volume mínimo p/ avaliar queda" },
  { key: "sellThroughPct", label: "Premissa: escoamento (%)", hint: "parado/excesso" },
  { key: "excessTargetCoverageDays", label: "Cobertura-alvo do excesso (dias)" },
  { key: "highMarginLiftPct", label: "Premissa: aumento c/ venda ativa (%)" },
  { key: "bundleDiscountPct", label: "Desconto na venda casada (%)", step: 0.5 },
  { key: "bundleMinSupport", label: "Venda casada: mín. de pedidos juntos" },
  { key: "bundleMinConfidence", label: "Venda casada: confiança mínima (0–1)", step: 0.05 },
];

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("promotions:view");
  const parsed = query.safeParse(await searchParams);
  const q = parsed.success ? parsed.data : {};
  const status: PromotionStatus = q.status ?? "sugerida";
  const db = getDb();
  const [rows, pending, params] = await Promise.all([
    listPromotions(db, { status, type: q.tipo }),
    status === "sugerida" ? Promise.resolve(null) : listPromotions(db, { status: "sugerida" }),
    getSetting(db, "promotions.params"),
  ]);
  const totals = promotionTotals(rows);
  const manage = can(user, "promotions:manage");
  const href = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: q.status, tipo: q.tipo, ...patch })) if (v) sp.set(k, v);
    return `/promocoes?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Promoções"
        description={`Sugestões comerciais com margem mínima de ${params.minMarginPct}% e desconto máximo de ${params.maxDiscountPct}%. Nada é alterado no PedidoOK.`}
        actions={manage ? <GenerateButton /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={status === "sugerida" ? "Sugestões pendentes" : `Sugestões ${status}s`} value={totals.count} icon={Lightbulb} hint={pending ? `${pending.length} aguardando decisão` : undefined} />
        <Kpi label="Lucro bruto estimado" value={totals.profit} format="brl" icon={PiggyBank} delay={60} hint={`sobre ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totals.revenue)} de receita estimada`} />
        <Kpi label="Capital que pode ser liberado" value={totals.capital} format="brl" icon={Wallet} delay={120} hint="estoque parado ou em excesso convertido em caixa (a custo)" />
      </div>

      <div className="animate-rise mt-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-navy-100 bg-white p-1">
          {(["sugerida", "aprovada", "rejeitada"] as PromotionStatus[]).map((s) => (
            <Link key={s} href={href({ status: s === "sugerida" ? undefined : s })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all", status === s ? "bg-navy-900 text-white shadow-sm" : "text-navy-700 hover:bg-navy-50")}>
              {s === "sugerida" ? "Pendentes" : `${s}s`}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap rounded-lg border border-navy-100 bg-white p-1">
          <Link href={href({ tipo: undefined })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-all", !q.tipo ? "bg-navy-900 text-white shadow-sm" : "text-navy-700 hover:bg-navy-50")}>
            Todos os tipos
          </Link>
          {TYPES.map((t) => (
            <Link key={t} href={href({ tipo: t })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-all", q.tipo === t ? "bg-navy-900 text-white shadow-sm" : "text-navy-700 hover:bg-navy-50")}>
              {PROMOTION_LABELS[t]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <EmptyState
            title={status === "sugerida" ? "Nenhuma sugestão pendente" : `Nenhuma sugestão ${status}`}
            description={
              status === "sugerida"
                ? manage
                  ? "Clique em “Atualizar sugestões” para analisar os produtos. É preciso ter produtos e pedidos importados do PedidoOK."
                  : "Um gestor precisa atualizar as sugestões."
                : undefined
            }
          />
        ) : (
          rows.map((p, i) => <PromotionCard key={p.id} p={p} canDecide={manage} delay={Math.min(i, 8) * 40} />)
        )}
      </div>

      <details className="mt-6 rounded-xl border border-navy-100 bg-white">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-navy-950">
          Parâmetros administrativos <span className="ml-1 text-xs font-normal text-muted">{can(user, "settings:manage") ? "(editável pelo administrador)" : "(somente leitura)"}</span>
        </summary>
        <CardContent className="border-t border-navy-100">
          <ParamsForm
            fields={FIELDS}
            initial={params as unknown as Record<string, number>}
            endpoint="/api/settings/promotions"
            disabled={!can(user, "settings:manage")}
            successText="Parâmetros salvos. Clique em “Atualizar sugestões” para recalcular."
          />
        </CardContent>
      </details>
      <p className="mt-4 text-xs text-muted">
        Margem = (preço − custo) ÷ preço. Preço mínimo para a margem desejada = custo ÷ (1 − margem). Simplificação: não inclui impostos, comissões e frete.
      </p>
    </>
  );
}
