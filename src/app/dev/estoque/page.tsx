import { notFound } from "next/navigation";
import { DailyQuantityChart } from "@/components/charts/DailyQuantityChart";
import { AppShell } from "@/components/layout/AppShell";
import { StockTable } from "@/components/stock/StockTable";
import { Card, PageHeader } from "@/components/ui/primitives";
import { analyzeStock, DEFAULT_STOCK_PARAMS } from "@/lib/metrics/stock";
import { addDays, eachDay } from "@/lib/periods";
import type { StockRow } from "@/lib/queries/stock";

/** Demonstração do módulo de estoque — SOMENTE em desenvolvimento, valores de EXEMPLO. */
export default function StockPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const today = "2026-11-18";
  const sample = [
    { name: "Ração Premium Cães 15kg", sku: "RAC-015", stock: 18, min: 10, cost: 142.5, sold: 270, days: 70, lead: 12, last: "2026-11-17" },
    { name: "Areia Sanitária 4kg", sku: "ARE-004", stock: 0, min: 20, cost: 11.9, sold: 420, days: 80, lead: 5, last: "2026-11-16" },
    { name: "Petisco Bifinho 500g", sku: "PET-500", stock: 640, min: 0, cost: 8.4, sold: 180, days: 50, lead: null, last: "2026-11-15" },
    { name: "Coleira Antipulgas G", sku: "COL-00G", stock: 35, min: 0, cost: 39.9, sold: 0, days: 0, lead: 20, last: "2026-07-02" },
    { name: "Shampoo Neutro 500ml", sku: "SHA-500", stock: 60, min: 12, cost: 14.2, sold: 75, days: 30, lead: 7, last: "2026-11-12" },
    { name: "Tapete Higiênico 30un", sku: "TAP-030", stock: 9, min: 0, cost: 33.0, sold: 4, days: 2, lead: 10, last: "2026-10-30" },
  ];
  const rows: StockRow[] = sample.map((s, i) => {
    const input = {
      currentStock: s.stock, minimumStock: s.min, unitCost: s.cost,
      sold7: Math.round(s.sold / 13), sold30: Math.round(s.sold / 3), sold60: Math.round((s.sold * 2) / 3), sold90: s.sold,
      soldWindow: s.sold, saleDaysWindow: s.days, lastSaleDate: s.last, supplierLeadTimeDays: s.lead, historyDays: 365, today,
    };
    return {
      productId: `p${i}`, pedidookId: i, sku: s.sku, name: s.name, brand: null, category: null, packaging: "UN",
      salePrice: null, supplierId: null, supplierName: `Fornecedor ${String.fromCharCode(65 + (i % 3))}`,
      ...input, ...analyzeStock(input, DEFAULT_STOCK_PARAMS),
    };
  });
  const daily = eachDay(addDays(today, -89), today).map((date, i) => ({ date, quantity: [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 0 : 2 + ((i * 7) % 5) }));

  return (
    <AppShell role="ADMIN" name="Administrador (exemplo)" freshness="atualizado" lastSync={new Date()}>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning">Exemplo visual: valores fictícios. Esta página não existe em produção.</div>
      <PageHeader title="Estoque (exemplo)" description="Tabela e gráfico do módulo com SKUs fictícios" />
      <Card className="animate-rise">
        <StockTable rows={rows} />
      </Card>
      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-950">Vendas diárias (exemplo)</h2>
        <DailyQuantityChart data={daily} average={3} unit="UN" />
      </section>
      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">Como o sistema calculou — {rows[0].name}</h2>
        <ol className="space-y-2">{rows[0].explanation.map((l, i) => <li key={i} className="rounded-md bg-navy-50/70 px-3 py-2 text-xs text-navy-950">{l}</li>)}</ol>
      </section>
    </AppShell>
  );
}
