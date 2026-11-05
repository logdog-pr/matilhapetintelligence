import Link from "next/link";
import { QualityBadge, StatusBadge } from "@/components/stock/StockBadges";
import { Table, td, th } from "@/components/ui/primitives";
import { formatBRL, formatInt } from "@/lib/format";
import type { StockRow } from "@/lib/queries/stock";

const qty = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

/** Tabela de análise de estoque por SKU. */
export function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th className={th}>Produto</th>
          <th className={th}>Fornecedor</th>
          <th className={`${th} text-right`}>Estoque</th>
          <th className={`${th} text-right`} title="Vendido nos últimos 7 / 30 / 90 dias">Vendas 7/30/90d</th>
          <th className={`${th} text-right`}>Média/dia</th>
          <th className={`${th} text-right`}>Cobertura</th>
          <th className={`${th} text-right`}>Ponto repos.</th>
          <th className={`${th} text-right`}>Sugerido</th>
          <th className={`${th} text-right`}>Custo</th>
          <th className={th}>Estimativa</th>
          <th className={th}>Situação</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.productId} className="transition-colors hover:bg-navy-50/60">
            <td className={td}>
              <Link href={`/estoque/${r.productId}`} className="font-medium text-navy-900 hover:underline">
                {r.name}
              </Link>
              <div className="text-xs text-muted">
                {r.sku}
                {r.packaging ? ` · ${r.packaging}` : ""}
                {r.daysSinceLastSale !== null ? ` · última venda há ${r.daysSinceLastSale} d` : " · sem vendas"}
              </div>
            </td>
            <td className={`${td} text-xs`}>
              {r.supplierName ?? <span className="text-muted">—</span>}
              <div className="text-muted">{r.leadTimeIsDefault ? `prazo padrão ${r.leadTimeDays} d` : `prazo ${r.leadTimeDays} d`}</div>
            </td>
            <td className={`${td} text-right tabular-nums`}>
              {qty(r.currentStock)}
              {r.minimumStock ? <div className="text-xs text-muted">mín. {qty(r.minimumStock)}</div> : null}
            </td>
            <td className={`${td} text-right tabular-nums text-xs`}>
              {qty(r.sold7)} / {qty(r.sold30)} / {qty(r.sold90)}
            </td>
            <td className={`${td} text-right tabular-nums`}>{qty(r.avgDailyDemand)}</td>
            <td className={`${td} text-right tabular-nums`}>{r.coverageDays === null ? "—" : `${formatInt(r.coverageDays)} d`}</td>
            <td className={`${td} text-right tabular-nums`}>{qty(r.reorderPoint)}</td>
            <td className={`${td} text-right font-medium tabular-nums`}>{r.suggestedQty === null ? "—" : qty(r.suggestedQty)}</td>
            <td className={`${td} text-right tabular-nums`}>{r.suggestedCost === null || !r.suggestedQty ? "—" : formatBRL(r.suggestedCost)}</td>
            <td className={td}>
              <QualityBadge quality={r.quality} reasons={r.qualityReasons} />
            </td>
            <td className={td}>
              <StatusBadge status={r.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
