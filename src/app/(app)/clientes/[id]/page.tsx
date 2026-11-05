import { CalendarClock, CalendarX, Receipt, Repeat, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MonthlyRevenueChart } from "@/components/charts/MonthlyCharts";
import { ClassBadge } from "@/components/customers/ClassBadge";
import { Kpi } from "@/components/ui/Kpi";
import { Badge, Card, CardHeader, CardTitle, EmptyState, PageHeader, Table, td, th } from "@/components/ui/primitives";
import { HttpError } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { customerDetail } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";
import { formatBRL, formatDate, formatInt } from "@/lib/format";

export const metadata: Metadata = { title: "Cliente" };

const qty = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("customers:view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  let d: Awaited<ReturnType<typeof customerDetail>>;
  try {
    d = await customerDetail(getDb(), user, id);
  } catch (e) {
    if (e instanceof HttpError) {
      return (
        <>
          <PageHeader title="Cliente" />
          <EmptyState title={e.status === 403 ? "Cliente fora da sua carteira" : "Cliente sem compras registradas"} description={e.message} />
        </>
      );
    }
    throw e;
  }
  const c = d.customer;
  const overdue = c.expectedNextPurchase && c.expectedNextPurchase < d.today;

  return (
    <>
      <PageHeader
        title={c.tradeName ?? c.name}
        description={[c.tradeName ? c.name : null, c.cnpj ? `CNPJ/CPF ${c.cnpj}` : null, [c.city, c.state].filter(Boolean).join("/"), c.segment].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-3">
            <ClassBadge cls={c.class} reasons={c.reasons} />
            <Link href="/clientes" className="text-sm font-medium text-navy-700 hover:underline">
              ← Clientes
            </Link>
          </div>
        }
      />

      <div className="animate-rise mb-6 rounded-xl border border-navy-100 bg-white px-5 py-3 text-sm text-navy-950">
        <span className="font-medium">Por que “{c.class.replace("_", " ")}”: </span>
        <span className="text-muted">{c.reasons.join(" · ")}.</span>
        <span className="ml-1 text-muted">
          Vendedor responsável: <strong className="text-navy-900">{c.sellerNames ?? "—"}</strong>
          {c.phone && (
            <>
              {" "}
              · Telefone: <strong className="text-navy-900">{c.phone}</strong>
            </>
          )}
        </span>
        {d.scopedToSeller && <span className="ml-1 text-xs text-muted">(considerando só os seus pedidos)</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Última compra" value={c.daysWithoutBuying} icon={CalendarX} hint={`${formatDate(c.lastPurchase)} · dias sem comprar`} />
        <Kpi label="Intervalo médio" value={c.avgIntervalDays === null ? null : Math.round(c.avgIntervalDays)} icon={Repeat} delay={50} hint={c.usesIndividualPattern ? "dias entre compras" : "histórico curto (limites gerais)"} />
        <Kpi
          label="Próxima compra esperada"
          value={null}
          text={c.expectedNextPurchase ? formatDate(c.expectedNextPurchase) : "—"}
          icon={CalendarClock}
          delay={100}
          hint={c.expectedNextPurchase ? (overdue ? "atrasada: vale um contato" : "última compra + intervalo médio") : "sem padrão suficiente"}
        />
        <Kpi label="Ticket médio" value={c.averageTicket} format="brl" icon={Receipt} delay={150} hint={`${formatInt(c.orders)} pedidos`} />
        <Kpi label="Faturamento acumulado" value={c.totalRevenue} format="brl" icon={Wallet} delay={200} hint={`desde ${formatDate(c.firstPurchase)}`} />
        <Kpi label="Média mensal" value={c.monthlyRevenue} format="brl" icon={TrendingUp} delay={250} hint="faturamento ÷ meses de relacionamento" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="lift animate-rise rounded-xl border border-navy-100 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-navy-950">Compras por mês</h2>
          <p className="mb-4 text-xs text-muted">Últimos 12 meses</p>
          <MonthlyRevenueChart data={d.monthly} />
        </section>
        <Card className="lift animate-rise">
          <CardHeader>
            <CardTitle>Produtos que costuma comprar</CardTitle>
          </CardHeader>
          {d.products.length === 0 ? (
            <p className="p-5 text-sm text-muted">Sem itens registrados.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Produto</th>
                  <th className={`${th} text-right`}>Pedidos</th>
                  <th className={`${th} text-right`}>Qtd.</th>
                  <th className={th}>Última vez</th>
                </tr>
              </thead>
              <tbody>
                {d.products.map((p) => (
                  <tr key={p.pid}>
                    <td className={td}>
                      {p.name}
                      {p.sku && <span className="ml-1.5 text-xs text-muted">{p.sku}</span>}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(p.orders)}</td>
                    <td className={`${td} text-right tabular-nums`}>{qty(p.quantity)}</td>
                    <td className={`${td} tabular-nums`}>{formatDate(p.last_bought)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="lift animate-rise mt-6">
        <CardHeader>
          <CardTitle>Histórico de pedidos</CardTitle>
          <span className="text-xs text-muted">últimos {d.orders.length}</span>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <th className={th}>Emissão</th>
              <th className={th}>Nº</th>
              <th className={th}>Status</th>
              <th className={th}>Situação</th>
              {!d.scopedToSeller && <th className={th}>Vendedor</th>}
              <th className={`${th} text-right`}>Itens</th>
              <th className={`${th} text-right`}>Valor líquido</th>
            </tr>
          </thead>
          <tbody>
            {d.orders.map((o) => (
              <tr key={o.id} className={o.deleted_in_source || o.status !== "pedido" ? "text-muted" : ""}>
                <td className={`${td} tabular-nums`}>{formatDate(o.order_date)}</td>
                <td className={`${td} tabular-nums`}>{o.number ?? `#${o.pedidook_id}`}</td>
                <td className={td}>
                  {o.deleted_in_source ? <Badge tone="danger">excluído</Badge> : <Badge tone={o.status === "pedido" ? "navy" : "neutral"}>{o.status}</Badge>}
                </td>
                <td className={td}>{o.situation ?? "—"}</td>
                {!d.scopedToSeller && <td className={td}>{o.seller_name ?? "—"}</td>}
                <td className={`${td} text-right tabular-nums`}>{o.items}</td>
                <td className={`${td} text-right tabular-nums`}>{formatBRL(o.net_amount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="border-t border-navy-100 px-4 py-2.5 text-xs text-muted">Orçamentos, bonificações, trocas e pedidos excluídos aparecem em cinza e não entram no faturamento.</p>
      </Card>
    </>
  );
}
