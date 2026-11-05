import { z } from "zod";
import { HttpError, scopeSellerId, type Principal } from "@/lib/auth/rbac";
import type { Database } from "@/lib/db/types";
import { todayInSaoPaulo } from "@/lib/format";
import { CLASS_LABELS, type CustomerClass } from "@/lib/metrics/customers";
import {
  classCounts,
  classifyCustomers,
  customerMonthly,
  customerOrderHistory,
  customerUsualProducts,
  filterCustomers,
  sellerCanSeeCustomer,
} from "@/lib/queries/customers";

const CLASSES = Object.keys(CLASS_LABELS) as [CustomerClass, ...CustomerClass[]];

export const customersQuerySchema = z.object({
  classe: z.enum([...CLASSES, "oportunidades"]).optional(),
  vendedor: z.uuid().optional(),
  cidade: z.string().trim().max(60).optional(),
  uf: z.string().trim().length(2).optional(),
  faturamento_min: z.coerce.number().min(0).optional(),
  dias_min: z.coerce.number().int().min(0).max(3650).optional(),
  busca: z.string().trim().max(80).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type CustomersQuery = z.infer<typeof customersQuerySchema>;

const PAGE_SIZE = 50;

/**
 * Lista classificada conforme o perfil.
 * VENDEDOR: só os próprios clientes e só os próprios pedidos no histórico.
 * ADMIN/GESTOR: filtro por vendedor usa a associação oficial (ou o vendedor do último pedido).
 */
export async function customersPage(db: Database, user: Principal, q: CustomersQuery, now = new Date()) {
  const today = todayInSaoPaulo(now);
  const isSeller = user.role === "VENDEDOR";
  const ownSeller = isSeller ? scopeSellerId(user, q.vendedor ?? null) : null;
  const rows = await classifyCustomers(db, { asOf: today, sellerId: ownSeller });
  const filtered = filterCustomers(rows, {
    classe: q.classe,
    sellerId: isSeller ? null : (q.vendedor ?? null),
    cidade: q.cidade,
    uf: q.uf,
    faturamentoMin: q.faturamento_min,
    diasSemComprarMin: q.dias_min,
    busca: q.busca,
  });
  const scopeRows = isSeller || !q.vendedor ? rows : rows.filter((r) => r.sellerIds.includes(q.vendedor!));
  const page = q.pagina ?? 1;
  return {
    today,
    counts: classCounts(scopeRows),
    rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    states: [...new Set(rows.map((r) => r.state).filter(Boolean))].sort() as string[],
  };
}

/** Detalhe do cliente com verificação de acesso do vendedor no servidor. */
export async function customerDetail(db: Database, user: Principal, customerId: string, now = new Date()) {
  const today = todayInSaoPaulo(now);
  const isSeller = user.role === "VENDEDOR";
  const sellerId = isSeller ? scopeSellerId(user, null) : null;
  const [row] = await classifyCustomers(db, { asOf: today, sellerId, customerId });
  if (!row) {
    // cliente existe mas sem compras no escopo?
    throw new HttpError(404, "Cliente não encontrado ou sem compras no seu escopo.");
  }
  if (isSeller && !(await sellerCanSeeCustomer(db, sellerId!, row.pedidookId))) {
    throw new HttpError(403, "Este cliente não está vinculado a você.");
  }
  const [orders, products, monthly] = await Promise.all([
    customerOrderHistory(db, { customerPedidookId: row.pedidookId, sellerId, limit: 50 }),
    customerUsualProducts(db, { customerPedidookId: row.pedidookId, sellerId, limit: 10 }),
    customerMonthly(db, { customerPedidookId: row.pedidookId, end: today, sellerId }),
  ]);
  return { today, customer: row, orders, products, monthly, scopedToSeller: isSeller };
}

// ------------------------------------------------------------------ mapa de clientes

export interface MapPoint {
  id: string | null;
  name: string;
  city: string | null;
  state: string | null;
  cls: CustomerClass;
  revenue: number;
  monthly: number;
  lat: number;
  lng: number;
  precision: "exata" | "cidade";
}

export interface MapRegion {
  city: string;
  state: string | null;
  customers: number;
  revenue: number;
  atRisk: number;
}

/**
 * Pontos para o mapa de calor (mesmos filtros e escopo da lista de clientes).
 * Envia ao navegador só o necessário: nome, cidade, classe e valores — sem CNPJ/telefone.
 */
export async function customersMap(db: Database, user: Principal, q: CustomersQuery, now = new Date()) {
  const { locate } = await import("@/lib/geo/locate");
  const today = todayInSaoPaulo(now);
  const isSeller = user.role === "VENDEDOR";
  const ownSeller = isSeller ? scopeSellerId(user, q.vendedor ?? null) : null;
  const rows = await classifyCustomers(db, { asOf: today, sellerId: ownSeller });
  const filtered = filterCustomers(rows, {
    classe: q.classe,
    sellerId: isSeller ? null : (q.vendedor ?? null),
    cidade: q.cidade,
    uf: q.uf,
    faturamentoMin: q.faturamento_min,
    diasSemComprarMin: q.dias_min,
    busca: q.busca,
  });

  const points: MapPoint[] = [];
  let missing = 0;
  const regions = new Map<string, MapRegion>();
  for (const r of filtered) {
    const loc = locate(r);
    const key = `${(r.city ?? "Sem cidade").trim()}|${r.state ?? ""}`;
    const reg = regions.get(key) ?? { city: (r.city ?? "Sem cidade").trim(), state: r.state, customers: 0, revenue: 0, atRisk: 0 };
    reg.customers++;
    reg.revenue += r.totalRevenue;
    if (r.class === "em_risco" || r.class === "inativo") reg.atRisk++;
    regions.set(key, reg);
    if (!loc || loc.precision === "sem_localizacao") {
      missing++;
      continue;
    }
    points.push({
      id: r.customerId,
      name: r.tradeName ?? r.name,
      city: r.city,
      state: r.state,
      cls: r.class,
      revenue: r.totalRevenue,
      monthly: r.monthlyRevenue,
      lat: loc.lat,
      lng: loc.lng,
      precision: loc.precision,
    });
  }

  return {
    today,
    points,
    total: filtered.length,
    exact: points.filter((p) => p.precision === "exata").length,
    byCity: points.filter((p) => p.precision === "cidade").length,
    missing,
    regions: [...regions.values()].map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 })).sort((a, b) => b.customers - a.customers || b.revenue - a.revenue),
  };
}
