import { notFound } from "next/navigation";
import { ClassBadge } from "@/components/customers/ClassBadge";
import { AppShell } from "@/components/layout/AppShell";
import { PromotionCard } from "@/components/promotions/PromotionCard";
import { Card, PageHeader, Table, td, th } from "@/components/ui/primitives";
import { formatBRL, formatDate, formatInt } from "@/lib/format";
import { classifyCustomer } from "@/lib/metrics/customers";
import { suggestBundle, suggestForProduct, type ProductSignal } from "@/lib/metrics/promotions";
import { addDays } from "@/lib/periods";
import type { PromotionRow } from "@/lib/queries/promotions";

/** Demonstração — SOMENTE em desenvolvimento, valores de EXEMPLO calculados pelas funções reais. */
export default function CommercialPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const asOf = "2026-11-18";
  const serie = (n: number, every: number, lastAgo: number, amount: number) => Array.from({ length: n }, (_, i) => ({ date: addDays(asOf, -(lastAgo + (n - 1 - i) * every)), amount }));
  const customers = [
    { name: "Pet Shop Amigo Fiel", city: "Campinas/SP", orders: serie(8, 14, 4, 1850) },
    { name: "Agropet Boa Vista", city: "Sorocaba/SP", orders: serie(6, 21, 34, 3200) },
    { name: "Clínica Vet Patas", city: "Jundiaí/SP", orders: serie(5, 15, 70, 950) },
    { name: "Banho & Tosa Lulu", city: "Valinhos/SP", orders: [...serie(4, 12, 160, 700), { date: addDays(asOf, -6), amount: 820 }] },
    { name: "Casa de Ração Central", city: "Americana/SP", orders: serie(2, 9, 8, 1200) },
  ].map((c) => ({ ...c, m: classifyCustomer(c.orders, asOf) }));

  const sig = (o: Partial<ProductSignal>): ProductSignal => ({ productId: "x", name: "", sku: "", currentStock: 100, minimumStock: 10, unitCost: 60, salePrice: 100, avgDailyDemand: 1, sold30: 30, sold60: 60, status: "ok", daysSinceLastSale: 2, ...o });
  const suggestions = [
    suggestForProduct(sig({ name: "Coleira Antipulgas G", sku: "COL-G", status: "parado", daysSinceLastSale: 96, sold30: 0, sold60: 0, unitCost: 32, salePrice: 59.9, currentStock: 48 })),
    suggestForProduct(sig({ name: "Petisco Bifinho 500g", sku: "PET-500", status: "excesso", avgDailyDemand: 2, currentStock: 640, unitCost: 8.4, salePrice: 14.9 })),
    suggestBundle({ a: sig({ productId: "a", name: "Ração Premium 15kg", sku: "RAC-15" }), b: sig({ name: "Areia Sanitária 4kg", sku: "ARE-4", unitCost: 11.9, salePrice: 21.9 }), together: 18, ordersWithA: 64 }),
  ].filter(Boolean);
  const rows: PromotionRow[] = suggestions.map((s, i) => ({
    id: `s${i}`, type: s!.type, status: "sugerida", productId: null,
    productName: [ "Coleira Antipulgas G", "Petisco Bifinho 500g", "Areia Sanitária 4kg" ][i], sku: ["COL-G", "PET-500", "ARE-4"][i],
    relatedProductName: s!.type === "venda_casada" ? "Ração Premium 15kg" : null, relatedSku: s!.type === "venda_casada" ? "RAC-15" : null,
    situation: s!.situation, currentStock: s!.currentStock, unitCost: s!.unitCost, currentPrice: s!.currentPrice, suggestedPrice: s!.suggestedPrice,
    discountPct: s!.discountPct, estimatedMarginPct: s!.estimatedMarginPct, potentialQty: s!.potentialQty, estimatedRevenue: s!.estimatedRevenue,
    estimatedProfit: s!.estimatedProfit, capitalFreed: s!.capitalFreed, reasoning: s!.reasoning, createdAt: new Date(), decidedAt: null, decidedByName: null, decisionNote: null,
  }));

  return (
    <AppShell role="ADMIN" name="Administrador (exemplo)" freshness="atualizado" lastSync={new Date()}>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning">Exemplo visual: valores fictícios. Esta página não existe em produção.</div>
      <PageHeader title="Clientes (exemplo)" description="Classificação pela frequência individual de recompra" />
      <Card className="animate-rise">
        <Table>
          <thead><tr><th className={th}>Cliente</th><th className={th}>Classe</th><th className={th}>Última compra</th><th className={`${th} text-right`}>Dias sem comprar</th><th className={`${th} text-right`}>Intervalo médio</th><th className={`${th} text-right`}>Ticket médio</th><th className={`${th} text-right`}>Em jogo / mês</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.name}>
                <td className={td}><span className="font-medium text-navy-900">{c.name}</span><div className="text-xs text-muted">{c.city}</div></td>
                <td className={td}><ClassBadge cls={c.m.class} reasons={c.m.reasons} /><div className="mt-1 max-w-64 text-[11px] text-muted">{c.m.reasons.join(" · ")}</div></td>
                <td className={`${td} tabular-nums`}>{formatDate(c.m.lastPurchase)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatInt(c.m.daysWithoutBuying)}<div className="text-[11px] text-muted">risco após {c.m.riskAfterDays} d</div></td>
                <td className={`${td} text-right tabular-nums`}>{c.m.avgIntervalDays === null ? "—" : `${formatInt(c.m.avgIntervalDays)} d`}</td>
                <td className={`${td} text-right tabular-nums`}>{formatBRL(c.m.averageTicket)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatBRL(c.m.monthlyRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <h2 className="mb-3 mt-8 text-lg font-semibold text-navy-950">Promoções (exemplo)</h2>
      <div className="space-y-4">{rows.map((p, i) => <PromotionCard key={p.id} p={p} canDecide delay={i * 40} linkProducts={false} />)}</div>
    </AppShell>
  );
}
