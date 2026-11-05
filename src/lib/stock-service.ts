import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { todayInSaoPaulo } from "@/lib/format";
import { getStockAnalysis, STOCK_REPORTS, stockReport, stockTotals, type StockReport, type StockRow } from "@/lib/queries/stock";

export const stockQuerySchema = z.object({
  relatorio: z.enum(STOCK_REPORTS).optional(),
  busca: z.string().trim().max(80).optional(),
  fornecedor: z.uuid().optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type StockQuery = z.infer<typeof stockQuerySchema>;

const PAGE_SIZE = 50;

function matches(r: StockRow, term: string) {
  const t = term.toLowerCase();
  return [r.name, r.sku, r.brand, r.category, r.supplierName].some((v) => v?.toLowerCase().includes(t));
}

/** Relatório de estoque filtrado, paginado e com totais (sobre todos os produtos). */
export async function stockPage(db: Database, q: StockQuery, now = new Date()) {
  const today = todayInSaoPaulo(now);
  const { rows, params, history } = await getStockAnalysis(db, { today });
  const report: StockReport = q.relatorio ?? "comprar";
  let list = stockReport(rows, report);
  if (q.fornecedor) list = list.filter((r) => r.supplierId === q.fornecedor);
  if (q.busca) list = list.filter((r) => matches(r, q.busca!));
  const page = q.pagina ?? 1;
  const totalFiltered = list.length;
  return {
    today,
    report,
    params,
    history,
    totals: stockTotals(rows),
    counts: Object.fromEntries(STOCK_REPORTS.map((r) => [r, stockReport(rows, r).length])) as Record<StockReport, number>,
    filteredReplenishmentCost: Math.round(list.reduce((s, r) => s + (r.suggestedCost ?? 0), 0) * 100) / 100,
    rows: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: totalFiltered,
    page,
    pages: Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE)),
  };
}

export const stockParamsSchema = z.object({
  windowDays: z.number().int().min(7).max(365),
  safetyDays: z.number().int().min(0).max(180),
  reviewDays: z.number().int().min(0).max(180),
  defaultLeadTimeDays: z.number().int().min(0).max(365),
  minHistoryDays: z.number().int().min(1).max(365),
  excessCoverageDays: z.number().int().min(7).max(1095),
  idleDays: z.number().int().min(7).max(1095),
});
