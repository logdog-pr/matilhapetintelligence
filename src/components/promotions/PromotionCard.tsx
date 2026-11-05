import { ArrowRight, Link2, Snail, PackageSearch, Gem, TrendingDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatBRL, formatDateTime, formatPercent } from "@/lib/format";
import { PROMOTION_LABELS, type PromotionType } from "@/lib/metrics/promotions";
import type { PromotionRow } from "@/lib/queries/promotions";
import { DecisionButtons } from "./PromotionActions";

const ICONS: Record<PromotionType, typeof Snail> = {
  parado: Snail,
  excesso: PackageSearch,
  queda_vendas: TrendingDown,
  margem_alta: Gem,
  venda_casada: Link2,
};

const qty = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

function Num({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`tabular-nums text-navy-950 ${strong ? "text-base font-semibold" : "text-sm font-medium"}`}>{value}</p>
    </div>
  );
}

/** Uma sugestão: produto, situação, números completos (spec §12), justificativa e decisão. */
export function PromotionCard({ p, canDecide, delay = 0, linkProducts = true }: { p: PromotionRow; canDecide: boolean; delay?: number; linkProducts?: boolean }) {
  const Icon = ICONS[p.type];
  const name = p.productName ?? "Produto removido";
  return (
    <article className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5" style={{ animationDelay: `${delay}ms` }}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">
              <Icon className="h-3 w-3" aria-hidden />
              {PROMOTION_LABELS[p.type]}
            </Badge>
            {p.status !== "sugerida" && <Badge tone={p.status === "aprovada" ? "success" : "neutral"}>{p.status}</Badge>}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-navy-950">
            {linkProducts && p.productId ? (
              <Link href={`/estoque/${p.productId}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
            {p.sku && <span className="ml-1.5 text-xs font-normal text-muted">{p.sku}</span>}
          </h3>
          {p.type === "venda_casada" && p.relatedProductName && (
            <p className="text-xs text-muted">
              oferecer junto de <strong className="text-navy-900">{p.relatedProductName}</strong>
              {p.relatedSku ? ` (${p.relatedSku})` : ""}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted">{p.situation}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted">Impacto estimado</p>
          <p className="text-lg font-semibold tabular-nums text-navy-950">{formatBRL(p.estimatedProfit)}</p>
          <p className="text-[11px] text-muted">lucro bruto{p.capitalFreed ? ` · libera ${formatBRL(p.capitalFreed)} de estoque` : ""}</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-navy-50/60 p-3 sm:grid-cols-4 lg:grid-cols-7">
        <Num label="Estoque atual" value={qty(p.currentStock)} />
        <Num label="Custo" value={formatBRL(p.unitCost)} />
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">Preço</p>
          <p className="flex items-center gap-1 text-sm font-medium tabular-nums text-navy-950">
            {p.discountPct ? (
              <>
                <span className="text-muted line-through">{formatBRL(p.currentPrice)}</span>
                <ArrowRight className="h-3 w-3 text-muted" />
                {formatBRL(p.suggestedPrice)}
              </>
            ) : (
              formatBRL(p.currentPrice)
            )}
          </p>
        </div>
        <Num label="Desconto" value={p.discountPct ? formatPercent(p.discountPct) : "sem desconto"} />
        <Num label="Margem estimada" value={formatPercent(p.estimatedMarginPct)} />
        <Num label="Qtd. potencial" value={qty(p.potentialQty)} />
        <Num label="Receita estimada" value={formatBRL(p.estimatedRevenue)} />
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-navy-700">Justificativa e premissas</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
          {p.reasoning.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {p.status === "sugerida" ? (
          canDecide ? <DecisionButtons id={p.id} /> : <span className="text-xs text-muted">Aguardando decisão de um gestor.</span>
        ) : (
          <span className="text-xs text-muted">
            {p.status === "aprovada" ? "Aprovada" : "Rejeitada"} por {p.decidedByName ?? "—"} em {formatDateTime(p.decidedAt)}
            {p.decisionNote ? ` · “${p.decisionNote}”` : ""}
          </span>
        )}
        <span className="text-[11px] text-muted">Não altera preços no PedidoOK</span>
      </footer>
    </article>
  );
}
