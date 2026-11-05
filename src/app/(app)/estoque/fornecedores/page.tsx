import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Table, td, th } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatInt } from "@/lib/format";
import { listSuppliersWithLeadTime } from "@/lib/queries/stock";
import { getSetting } from "@/lib/settings";
import { LeadTimeInput, StockParamsForm } from "./StockSettingsForms";

export const metadata: Metadata = { title: "Prazos e parâmetros de estoque" };

export default async function StockSettingsPage() {
  const user = await requirePageUser("stock:view");
  const manage = can(user, "stock:manage");
  const db = getDb();
  const [list, params] = await Promise.all([listSuppliersWithLeadTime(db), getSetting(db, "stock.params")]);
  const configured = list.filter((s) => s.leadTimeDays !== null).length;

  return (
    <>
      <PageHeader
        title="Prazos e parâmetros"
        description="O PedidoOK não informa prazo de entrega: configure por fornecedor para melhorar as sugestões de compra."
        actions={
          <Link href="/estoque" className="text-sm font-medium text-navy-700 hover:underline">
            ← Estoque
          </Link>
        }
      />

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>Parâmetros de reposição</CardTitle>
          {!manage && <span className="text-xs text-muted">somente o administrador altera</span>}
        </CardHeader>
        <CardContent>
          <StockParamsForm initial={params} disabled={!manage} />
        </CardContent>
      </Card>

      <Card className="animate-rise mt-6" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>Prazo de entrega por fornecedor</CardTitle>
          <span className="text-xs text-muted">
            {formatInt(configured)} de {formatInt(list.length)} configurados · vazio = padrão de {params.defaultLeadTimeDays} dias
          </span>
        </CardHeader>
        {list.length === 0 ? (
          <CardContent>
            <EmptyState title="Nenhum fornecedor sincronizado" description="Os fornecedores aparecem após a importação do PedidoOK." />
          </CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Fornecedor</th>
                <th className={`${th} text-right`}>Produtos ativos</th>
                <th className={`${th} text-right`}>Prazo de entrega (dias)</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-navy-50/60">
                  <td className={td}>
                    {s.tradeName ?? s.name}
                    {s.tradeName && <div className="text-xs text-muted">{s.name}</div>}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{formatInt(s.products)}</td>
                  <td className={`${td} text-right`}>
                    <LeadTimeInput supplierId={s.id} initial={s.leadTimeDays} disabled={!manage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
