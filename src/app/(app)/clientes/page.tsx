import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ClassBadge } from "@/components/customers/ClassBadge";
import { ViewToggle } from "@/components/customers/ViewToggle";
import { ParamsForm, type ParamField } from "@/components/forms/ParamsForm";
import { Card, CardContent, EmptyState, PageHeader, Select, Table, inputClass, td, th } from "@/components/ui/primitives";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { customersPage, customersQuerySchema } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { formatBRL, formatDate, formatInt } from "@/lib/format";
import { CLASS_LABELS, type CustomerClass } from "@/lib/metrics/customers";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

const CLASS_ORDER: CustomerClass[] = ["recorrente", "ativo", "novo", "recuperado", "em_risco", "inativo"];

const CLASSIFICATION_FIELDS: ParamField[] = [
  { key: "riskFactor", label: "Em risco após (× intervalo)", hint: "padrão 1,5 × o intervalo médio do cliente", step: 0.1 },
  { key: "inactiveFactor", label: "Inativo após (× intervalo)", hint: "padrão 2,5 × o intervalo médio", step: 0.1 },
  { key: "minOrdersForPattern", label: "Compras p/ padrão individual", hint: "abaixo disso usa os limites gerais" },
  { key: "generalRiskDays", label: "Limite geral de risco (dias)", hint: "clientes com histórico curto" },
  { key: "generalInactiveDays", label: "Limite geral de inativo (dias)" },
  { key: "newDays", label: "Novo: 1ª compra até (dias)" },
  { key: "recoveredWindowDays", label: "Recuperado: voltou há até (dias)" },
  { key: "recurringMinOrders", label: "Recorrente: mín. de compras" },
  { key: "recurringWindowDays", label: "Recorrente: janela (dias)" },
  { key: "minRiskDays", label: "Piso de risco (dias)" },
  { key: "minInactiveDays", label: "Piso de inativo (dias)" },
];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("customers:view");
  if (user.role === "VENDEDOR" && !user.sellerId) return <EmptyState title="Usuário sem vendedor vinculado" />;

  const raw = await searchParams;
  const parsed = customersQuerySchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== "" && v !== undefined)));
  const q = parsed.success ? parsed.data : {};
  const db = getDb();
  const isSeller = user.role === "VENDEDOR";
  const [data, sellerOptions, params] = await Promise.all([
    customersPage(db, user, isSeller ? { ...q, vendedor: undefined } : q),
    isSeller ? Promise.resolve([]) : db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.deletedInSource, false)).orderBy(asc(sellers.name)),
    getSetting(db, "customers.classification"),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      classe: q.classe,
      vendedor: q.vendedor,
      cidade: q.cidade,
      uf: q.uf,
      faturamento_min: q.faturamento_min?.toString(),
      dias_min: q.dias_min?.toString(),
      busca: q.busca,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/clientes?${sp.toString()}`;
  };
  const opportunities = q.classe === "oportunidades";

  return (
    <>
      <PageHeader
        title={isSeller ? "Meus clientes" : "Clientes"}
        description={`Classificação pela frequência de recompra de cada cliente · referência ${formatDate(data.today)}${isSeller ? " · considera só os seus pedidos" : ""}`}
        actions={
          <ViewToggle
            active="lista"
            query={new URLSearchParams(Object.entries(raw).filter(([k, v]) => !!v && k !== "pagina") as [string, string][]).toString()}
          />
        }
      />

      {/* Classes (clicáveis) */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <Link
          href={href({ classe: "oportunidades", pagina: undefined })}
          className={cn(
            "lift animate-rise rounded-xl border p-4",
            opportunities ? "border-navy-900 bg-navy-900 text-white" : "border-navy-100 bg-white",
          )}
        >
          <p className={cn("text-[11px] uppercase tracking-wide", opportunities ? "text-navy-200" : "text-muted")}>Oportunidades</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(data.counts.em_risco + data.counts.inativo)}</p>
          <p className={cn("mt-0.5 text-[11px]", opportunities ? "text-navy-200" : "text-muted")}>{formatBRL(data.counts.atStakeMonthly)}/mês em jogo</p>
        </Link>
        {CLASS_ORDER.map((c, i) => (
          <Link
            key={c}
            href={href({ classe: q.classe === c ? undefined : c, pagina: undefined })}
            className={cn("lift animate-rise rounded-xl border bg-white p-4", q.classe === c ? "border-navy-700 ring-2 ring-navy-100" : "border-navy-100")}
            style={{ animationDelay: `${(i + 1) * 40}ms` }}
          >
            <ClassBadge cls={c} />
            <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-950">{formatInt(data.counts[c])}</p>
          </Link>
        ))}
      </div>

      {/* Filtros numa linha */}
      <form action="/clientes" className="animate-rise mt-6 flex flex-wrap items-center gap-2">
        {q.classe && <input type="hidden" name="classe" value={q.classe} />}
        <input name="busca" defaultValue={q.busca ?? ""} placeholder="Nome, fantasia ou CNPJ" className={cn(inputClass, "h-8 w-52 text-xs")} />
        {!isSeller && (
          <Select name="vendedor" defaultValue={q.vendedor ?? ""} className="h-8 w-44 text-xs">
            <option value="">Todos os vendedores</option>
            {sellerOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <input name="cidade" defaultValue={q.cidade ?? ""} placeholder="Cidade" className={cn(inputClass, "h-8 w-32 text-xs")} />
        <Select name="uf" defaultValue={q.uf ?? ""} className="h-8 w-20 text-xs">
          <option value="">UF</option>
          {data.states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <input name="faturamento_min" type="number" min={0} defaultValue={q.faturamento_min ?? ""} placeholder="Faturamento mín. (R$)" className={cn(inputClass, "h-8 w-40 text-xs")} />
        <input name="dias_min" type="number" min={0} defaultValue={q.dias_min ?? ""} placeholder="Dias sem comprar ≥" className={cn(inputClass, "h-8 w-36 text-xs")} />
        <button className="h-8 rounded-lg bg-navy-50 px-3 text-xs font-medium text-navy-900 transition-colors hover:bg-navy-100">Filtrar</button>
        {Object.values(q).some(Boolean) && (
          <Link href="/clientes" className="text-xs text-navy-700 hover:underline">
            Limpar
          </Link>
        )}
      </form>
      {opportunities && (
        <p className="mt-2 text-xs text-muted">
          Clientes em risco e inativos, ordenados pelo faturamento médio mensal que deixa de entrar. Contato sugerido: começar do topo.
        </p>
      )}

      <div className="mt-4">
        {data.total === 0 ? (
          <EmptyState
            title={data.counts.total === 0 ? "Nenhum cliente com compras registradas" : "Nenhum cliente com esses filtros"}
            description={data.counts.total === 0 ? "Os clientes aparecem após a importação dos pedidos do PedidoOK." : undefined}
          />
        ) : (
          <Card className="animate-rise">
            <Table>
              <thead>
                <tr>
                  <th className={th}>Cliente</th>
                  <th className={th}>Classe</th>
                  {!isSeller && <th className={th}>Vendedor</th>}
                  <th className={th}>Última compra</th>
                  <th className={`${th} text-right`}>Dias sem comprar</th>
                  <th className={`${th} text-right`}>Intervalo médio</th>
                  <th className={`${th} text-right`}>Ticket médio</th>
                  <th className={`${th} text-right`}>{opportunities ? "Em jogo / mês" : "Faturamento acumulado"}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.pedidookId} className="transition-colors hover:bg-navy-50/60">
                    <td className={td}>
                      {r.customerId ? (
                        <Link href={`/clientes/${r.customerId}`} className="font-medium text-navy-900 hover:underline">
                          {r.tradeName ?? r.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.name}</span>
                      )}
                      <div className="text-xs text-muted">{[r.tradeName ? r.name : null, [r.city, r.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className={td}>
                      <ClassBadge cls={r.class} reasons={r.reasons} />
                    </td>
                    {!isSeller && <td className={`${td} text-xs`}>{r.sellerNames ?? "—"}</td>}
                    <td className={`${td} tabular-nums`}>{formatDate(r.lastPurchase)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {formatInt(r.daysWithoutBuying)}
                      <div className="text-[11px] text-muted">risco após {r.riskAfterDays} d</div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{r.avgIntervalDays === null ? "—" : `${formatInt(r.avgIntervalDays)} d`}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.averageTicket === null ? "—" : formatBRL(r.averageTicket)}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatBRL(opportunities ? r.monthlyRevenue : r.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-xs text-muted">
              <span>
                {formatInt(data.total)} cliente(s) · página {data.page} de {data.pages} · passe o mouse na classe para ver o motivo
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

      {!isSeller && (
        <details className="group mt-6 rounded-xl border border-navy-100 bg-white">
          <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-navy-950">
            Regras de classificação <span className="ml-1 text-xs font-normal text-muted">{can(user, "settings:manage") ? "(editável pelo administrador)" : "(somente leitura)"}</span>
          </summary>
          <CardContent className="border-t border-navy-100">
            <ParamsForm
              fields={CLASSIFICATION_FIELDS}
              initial={params as unknown as Record<string, number>}
              endpoint="/api/settings/customers"
              disabled={!can(user, "settings:manage")}
              successText="Regras salvas. A classificação já usa os novos valores."
            />
          </CardContent>
        </details>
      )}
      <p className="mt-4 text-xs text-muted">
        Classes: {CLASS_ORDER.map((c) => CLASS_LABELS[c]).join(", ")}. “Novo” depende do histórico importado do PedidoOK: um cliente antigo cuja primeira compra não foi importada aparece como novo.
      </p>
    </>
  );
}
