import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { CustomerHeatMap } from "@/components/customers/CustomerHeatMap";
import { ViewToggle } from "@/components/customers/ViewToggle";
import { Card, CardHeader, CardTitle, EmptyState, PageHeader, Select } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { customersMap, customersQuerySchema } from "@/lib/customers-service";
import { getDb } from "@/lib/db/client";
import { sellers } from "@/lib/db/schema";
import { formatBRL, formatInt, formatPercent } from "@/lib/format";
import { CLASS_LABELS, type CustomerClass } from "@/lib/metrics/customers";

export const metadata: Metadata = { title: "Mapa de clientes" };

const CLASSES = Object.keys(CLASS_LABELS) as CustomerClass[];

export default async function CustomersMapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser("customers:view");
  if (user.role === "VENDEDOR" && !user.sellerId) return <EmptyState title="Usuário sem vendedor vinculado" />;
  const raw = await searchParams;
  const clean = Object.fromEntries(Object.entries(raw).filter(([k, v]) => v !== "" && v !== undefined && k !== "pagina")) as Record<string, string>;
  const parsed = customersQuerySchema.safeParse(clean);
  const q = parsed.success ? parsed.data : {};
  const isSeller = user.role === "VENDEDOR";
  const db = getDb();
  const [data, sellerOptions] = await Promise.all([
    customersMap(db, user, isSeller ? { ...q, vendedor: undefined } : q),
    isSeller ? Promise.resolve([]) : db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.deletedInSource, false)).orderBy(asc(sellers.name)),
  ]);
  const query = new URLSearchParams(clean).toString();
  const located = data.exact + data.byCity;

  return (
    <>
      <PageHeader
        title={isSeller ? "Mapa dos meus clientes" : "Mapa de clientes"}
        description="Onde estão os clientes: calor por quantidade ou faturamento. Aproxime para ver cada cliente."
        actions={<ViewToggle active="mapa" query={query} />}
      />

      <form action="/clientes/mapa" className="animate-rise mb-4 flex flex-wrap items-center gap-2">
        <Select name="classe" defaultValue={q.classe ?? ""} className="h-8 w-48 text-xs">
          <option value="">Todas as classes</option>
          <option value="oportunidades">Oportunidades (em risco + inativos)</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {CLASS_LABELS[c]}
            </option>
          ))}
        </Select>
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
        <button className="h-8 rounded-lg bg-navy-50 px-3 text-xs font-medium text-navy-900 transition-colors hover:bg-navy-100">Aplicar</button>
        {query && (
          <Link href="/clientes/mapa" className="text-xs text-navy-700 hover:underline">
            Limpar
          </Link>
        )}
      </form>

      {data.total === 0 ? (
        <EmptyState title="Nenhum cliente para mostrar" description="Os clientes aparecem após a importação dos pedidos do PedidoOK." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="animate-rise">
            <CustomerHeatMap points={data.points.map((p) => ({ ...p, clsLabel: CLASS_LABELS[p.cls] }))} />
            <p className="mt-2 text-xs text-muted">
              {formatInt(located)} de {formatInt(data.total)} clientes no mapa ({formatPercent(data.total ? (located / data.total) * 100 : 0)}) · {formatInt(data.exact)} com
              coordenada do PedidoOK · {formatInt(data.byCity)} pelo centro da cidade (IBGE) · {formatInt(data.missing)} sem cidade/UF reconhecida. Os dados dos
              clientes são desenhados no seu navegador; o serviço de mapas recebe só a região visível.
            </p>
          </div>

          <Card className="animate-rise h-fit" style={{ animationDelay: "80ms" }}>
            <CardHeader>
              <CardTitle>Regiões</CardTitle>
              <span className="text-xs text-muted">{formatInt(data.regions.length)} cidades</span>
            </CardHeader>
            <ol className="max-h-[520px] divide-y divide-navy-50 overflow-y-auto">
              {data.regions.slice(0, 40).map((r, i) => {
                const max = data.regions[0]?.customers || 1;
                return (
                  <li key={`${r.city}|${r.state}`}>
                    <Link
                      href={`/clientes?${new URLSearchParams({ ...clean, cidade: r.city, ...(r.state ? { uf: r.state } : {}) }).toString()}`}
                      className="block px-4 py-2.5 transition-colors hover:bg-navy-50/70"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-navy-950">
                          <span className="mr-1 tabular-nums text-muted">{i + 1}.</span>
                          {r.city}
                          {r.state && <span className="text-muted">/{r.state}</span>}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-navy-950">{formatInt(r.customers)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-50">
                        <div className="h-full rounded-full bg-[#2f5fc4]" style={{ width: `${Math.max(3, (r.customers / max) * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatBRL(r.revenue)} acumulado{r.atRisk ? ` · ${formatInt(r.atRisk)} em risco/inativos` : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
