import { Calculator, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DailyQuantityChart } from "@/components/charts/DailyQuantityChart";
import { QualityBadge, StatusBadge } from "@/components/stock/StockBadges";
import { PageHeader } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatBRL, formatDate, formatInt, todayInSaoPaulo } from "@/lib/format";
import { addDays } from "@/lib/periods";
import { getStockAnalysis, productDailySales } from "@/lib/queries/stock";

export const metadata: Metadata = { title: "Produto" };

const qty = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="lift animate-rise rounded-xl border border-navy-100 bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-navy-950">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export default async function ProductStockPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser("stock:view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const today = todayInSaoPaulo();
  const { rows, params: p, history } = await getStockAnalysis(db, { today, productId: id });
  const r = rows[0];
  if (!r) notFound();
  const daily = await productDailySales(db, r.pedidookId, addDays(today, -89), today);

  return (
    <>
      <PageHeader
        title={r.name}
        description={[r.sku, r.brand, r.category, r.packaging].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={r.status} />
            <Link href="/estoque" className="text-sm font-medium text-navy-700 hover:underline">
              ← Estoque
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Fact label="Estoque atual" value={qty(r.currentStock)} hint={r.minimumStock ? `mínimo cadastrado ${qty(r.minimumStock)}` : "sem mínimo cadastrado"} />
        <Fact label="Demanda média" value={`${qty(r.avgDailyDemand)}/dia`} hint={`${qty(r.soldWindow)} vendidos em ${r.daysAnalyzed} dias`} />
        <Fact label="Cobertura" value={r.coverageDays === null ? "—" : `${formatInt(r.coverageDays)} dias`} hint={r.daysSinceLastSale === null ? "nunca vendido no histórico" : `última venda há ${r.daysSinceLastSale} dia(s)`} />
        <Fact label="Sugestão de compra" value={r.suggestedQty === null ? "—" : qty(r.suggestedQty)} hint={r.suggestedCost ? `custo estimado ${formatBRL(r.suggestedCost)}` : undefined} />
        <Fact label="Valor em estoque" value={r.stockValue === null ? "—" : formatBRL(r.stockValue)} hint={r.unitCost === null ? "custo não informado" : `custo unitário ${formatBRL(r.unitCost)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5 lg:col-span-3">
          <h2 className="mb-1 text-sm font-semibold text-navy-950">Vendas diárias</h2>
          <p className="mb-4 text-xs text-muted">Últimos 90 dias · 7 d: {qty(r.sold7)} · 30 d: {qty(r.sold30)} · 60 d: {qty(r.sold60)} · 90 d: {qty(r.sold90)}</p>
          <DailyQuantityChart data={daily} average={r.avgDailyDemand} unit={r.packaging} />
        </section>

        <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5 lg:col-span-2" style={{ animationDelay: "80ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950">
              <Calculator className="h-4 w-4 text-navy-500" /> Como o sistema calculou
            </h2>
            <QualityBadge quality={r.quality} reasons={r.qualityReasons} />
          </div>
          <ol className="space-y-2">
            {r.explanation.map((line, i) => (
              <li key={i} className="rounded-md bg-navy-50/70 px-3 py-2 text-xs leading-relaxed text-navy-950">
                {line}
              </li>
            ))}
          </ol>
          {r.qualityReasons.length > 0 && (
            <div className="mt-4 rounded-md border border-navy-100 px-3 py-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-navy-900">
                <Info className="h-3.5 w-3.5" /> Limitações desta estimativa
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                {r.qualityReasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-[11px] text-muted">
            Parâmetros: janela {p.windowDays} d · segurança {p.safetyDays} d · revisão {p.reviewDays} d · prazo {r.leadTimeDays} d
            {r.leadTimeIsDefault ? " (padrão)" : ` (${r.supplierName ?? "fornecedor"})`}. Histórico desde {history.since ? formatDate(history.since) : "—"}.
          </p>
        </section>
      </div>
    </>
  );
}
