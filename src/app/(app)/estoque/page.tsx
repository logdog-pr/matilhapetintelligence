import { Boxes, PackageX, ShoppingCart, Snail, Wallet, Warehouse } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StockTable } from "@/components/stock/StockTable";
import { Kpi } from "@/components/ui/Kpi";
import { Card, EmptyState, PageHeader, Select, inputClass } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatBRL, formatDate, formatInt } from "@/lib/format";
import { listSuppliersWithLeadTime, STOCK_REPORT_LABELS, STOCK_REPORTS, type StockReport } from "@/lib/queries/stock";
import { stockPage, stockQuerySchema } from "@/lib/stock-service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estoque" };

const REPORT_HELP: Record<StockReport, string> = {
  comprar: "Abaixo do ponto de reposição (ou do mínimo), com sugestão de compra.",
  ruptura: "Sem estoque e com demanda ou estoque mínimo cadastrado.",
  excesso: "Cobertura acima do limite configurado.",
  parados: "Com estoque e sem venda há mais dias que o limite configurado.",
  giro: "Maior demanda média diária.",
  investimento: "Maior valor parado em estoque (estoque atual × custo).",
  todos: "Todos os produtos ativos.",
};

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("stock:view");
  const parsed = stockQuerySchema.safeParse(await searchParams);
  const q = parsed.success ? parsed.data : {};
  const db = getDb();
  const [data, supplierList] = await Promise.all([stockPage(db, q), listSuppliersWithLeadTime(db)]);
  const { totals, params, history } = data;
  const manage = can(user, "stock:manage");

  const href = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { relatorio: data.report, busca: q.busca, fornecedor: q.fornecedor, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/estoque?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Estoque"
        description={`Análise por SKU · demanda dos últimos ${params.windowDays} dias até ${formatDate(data.today)}`}
        actions={
          <Link href="/estoque/fornecedores" className="text-sm font-medium text-navy-700 hover:underline">
            {manage ? "Prazos e parâmetros" : "Ver prazos e parâmetros"} →
          </Link>
        }
      />

      {history.days < params.minHistoryDays && (
        <div className="animate-rise mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
          {history.since
            ? `Há só ${history.days} dia(s) de histórico de pedidos (desde ${formatDate(history.since)}). `
            : "Nenhum pedido importado ainda. "}
          Sugestões de compra exigem ao menos {params.minHistoryDays} dias; até lá, só aparece a reposição até o estoque mínimo cadastrado.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Produtos ativos" value={totals.products} icon={Boxes} />
        <Kpi label="Valor em estoque" value={totals.stockValue} format="brl" icon={Warehouse} delay={50} hint="estoque atual × custo" />
        <Kpi label="Para comprar" value={totals.toBuy} icon={ShoppingCart} delay={100} href={href({ relatorio: "comprar", pagina: undefined })} />
        <Kpi label="Custo da reposição" value={totals.replenishmentCost} format="brl" icon={Wallet} delay={150} hint="soma das sugestões" />
        <Kpi label="Em ruptura" value={totals.rupture} icon={PackageX} delay={200} href={href({ relatorio: "ruptura", pagina: undefined })} />
        <Kpi label="Valor parado" value={totals.idleValue} format="brl" icon={Snail} delay={250} hint={`${formatInt(totals.idle)} produtos sem venda há ${params.idleDays}+ dias`} />
      </div>

      {/* Relatórios + filtros numa linha */}
      <div className="animate-rise mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg border border-navy-100 bg-white p-1" role="tablist" aria-label="Relatórios de estoque">
          {STOCK_REPORTS.map((r) => (
            <Link
              key={r}
              href={href({ relatorio: r, pagina: undefined })}
              role="tab"
              aria-selected={data.report === r}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                data.report === r ? "bg-navy-900 text-white shadow-sm" : "text-navy-700 hover:bg-navy-50",
              )}
            >
              {STOCK_REPORT_LABELS[r]} <span className={cn("ml-0.5 tabular-nums", data.report === r ? "text-navy-200" : "text-muted")}>{data.counts[r]}</span>
            </Link>
          ))}
        </div>
        <form action="/estoque" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="relatorio" value={data.report} />
          <input name="busca" defaultValue={q.busca ?? ""} placeholder="Buscar SKU, nome, marca…" className={cn(inputClass, "h-8 w-56 text-xs")} />
          <Select name="fornecedor" defaultValue={q.fornecedor ?? ""} className="h-8 w-48 text-xs">
            <option value="">Todos os fornecedores</option>
            {supplierList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.tradeName ?? s.name}
              </option>
            ))}
          </Select>
          <button className="h-8 rounded-lg bg-navy-50 px-3 text-xs font-medium text-navy-900 transition-colors hover:bg-navy-100">Filtrar</button>
        </form>
      </div>
      <p className="mt-2 text-xs text-muted">
        {REPORT_HELP[data.report]} {data.report === "comprar" && data.total > 0 && <>Custo estimado da lista: <strong className="text-navy-900">{formatBRL(data.filteredReplenishmentCost)}</strong>.</>}
      </p>

      <div className="mt-4">
        {data.total === 0 ? (
          <EmptyState
            title={totals.products === 0 ? "Nenhum produto sincronizado" : "Nenhum produto neste relatório"}
            description={totals.products === 0 ? "Os produtos aparecem após a importação do PedidoOK." : undefined}
          />
        ) : (
          <Card className="animate-rise">
            <StockTable rows={data.rows} />
            <div className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-xs text-muted">
              <span>
                {formatInt(data.total)} produto(s) · página {data.page} de {data.pages} · passe o mouse em “Estimativa” para ver o motivo
              </span>
              <div className="flex gap-2">
                {data.page > 1 && (
                  <Link href={href({ pagina: String(data.page - 1) })} className="rounded-md border border-navy-100 px-3 py-1 text-navy-900 hover:bg-navy-50">
                    Anterior
                  </Link>
                )}
                {data.page < data.pages && (
                  <Link href={href({ pagina: String(data.page + 1) })} className="rounded-md border border-navy-100 px-3 py-1 text-navy-900 hover:bg-navy-50">
                    Próxima
                  </Link>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">
        Quantidades na unidade de venda do PedidoOK. Compras pendentes e movimentações não existem na API (consideradas 0). Estoque = estoque atual do PedidoOK.
      </p>
    </>
  );
}
