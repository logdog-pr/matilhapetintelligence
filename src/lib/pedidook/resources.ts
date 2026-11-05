/**
 * Definição dos recursos sincronizados: endpoint, chave do JSON, schema,
 * persistência (upsert idempotente por pedidook_id) e tabela de contagem.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, getTableColumns, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import * as t from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import {
  mapCliente,
  mapCobranca,
  mapCondicaoPagamento,
  mapFornecedor,
  mapPedido,
  mapProduto,
  mapTabelaPreco,
  mapVendedor,
} from "./mappers";
import {
  clienteSchema,
  cobrancaSchema,
  condicaoPagamentoSchema,
  fornecedorSchema,
  pedidoSchema,
  produtoSchema,
  tabelaPrecoSchema,
  vendedorSchema,
} from "./schemas";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface UpsertResult {
  created: number;
  updated: number;
}

export interface ListResource<S extends z.ZodType = z.ZodType> {
  key: ListResourceKey;
  label: string;
  path: string;
  listKey: string;
  schema: S;
  table: PgTable;
  /** Registros já validados pelo `schema`. */
  upsert: (tx: Tx, records: any[]) => Promise<UpsertResult>;
}

export const LIST_RESOURCE_KEYS = [
  "vendedores",
  "fornecedores",
  "produtos",
  "clientes",
  "condicoes_pagamento",
  "tabelas_preco",
  "pedidos",
  "cobrancas",
] as const;
export type ListResourceKey = (typeof LIST_RESOURCE_KEYS)[number];

/** Recurso especial: 1 requisição por cliente (GET /clientes/{id}/vendedores). */
export const ASSOCIATION_RESOURCE = "clientes_vendedores" as const;
export type ResourceKey = ListResourceKey | typeof ASSOCIATION_RESOURCE;

/** Ordem de importação (dependências primeiro). */
export const RESOURCE_ORDER: ResourceKey[] = [...LIST_RESOURCE_KEYS, ASSOCIATION_RESOURCE];

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  vendedores: "Vendedores",
  fornecedores: "Fornecedores",
  produtos: "Produtos",
  clientes: "Clientes",
  condicoes_pagamento: "Condições de pagamento",
  tabelas_preco: "Tabelas de preço",
  pedidos: "Pedidos",
  cobrancas: "Cobranças",
  clientes_vendedores: "Clientes × Vendedores",
};

// ------------------------------------------------------------------ helpers

function excludedSet(table: PgTable, keys: string[]): Record<string, SQL> {
  const cols = getTableColumns(table) as Record<string, { name: string }>;
  const set: Record<string, SQL> = {};
  for (const k of keys) {
    if (k === "pedidookId" || !cols[k]) continue;
    set[k] = sql.raw(`excluded."${cols[k].name}"`);
  }
  if (cols.updatedAt) set.updatedAt = sql`now()`;
  return set;
}

/** Upsert por pedidook_id. Usa `xmax = 0` para distinguir inserção de atualização. */
async function upsertByPedidookId(tx: Tx, table: PgTable, rows: Record<string, unknown>[]): Promise<UpsertResult> {
  if (rows.length === 0) return { created: 0, updated: 0 };
  // Deduplica dentro do lote (a mesma página não deve repetir, mas por segurança)
  const unique = [...new Map(rows.map((r) => [r.pedidookId, r])).values()];
  const tbl = table as any;
  const res: { inserted: boolean }[] = await tx
    .insert(tbl)
    .values(unique)
    .onConflictDoUpdate({ target: tbl.pedidookId, set: excludedSet(table, Object.keys(unique[0])) })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });
  const created = res.filter((r) => r.inserted).length;
  return { created, updated: res.length - created };
}

const simple =
  <S extends z.ZodType>(table: PgTable, map: (r: z.infer<S>) => Record<string, unknown>) =>
  (tx: Tx, records: z.infer<S>[]) =>
    upsertByPedidookId(tx, table, records.map(map));

// ------------------------------------------------------------------ pedidos (cabeçalho + itens)

async function upsertPedidos(tx: Tx, records: z.infer<typeof pedidoSchema>[]): Promise<UpsertResult> {
  const mapped = records.map(mapPedido);
  const result = await upsertByPedidookId(
    tx,
    t.orders,
    mapped.map((m) => m.order),
  );

  const ids = await tx
    .select({ id: t.orders.id, pedidookId: t.orders.pedidookId })
    .from(t.orders)
    .where(inArray(t.orders.pedidookId, mapped.map((m) => m.order.pedidookId)));
  const idByPid = new Map(ids.map((r) => [r.pedidookId, r.id]));

  for (const m of mapped) {
    const orderId = idByPid.get(m.order.pedidookId)!;
    const items = [...new Map(m.items.map((i) => [i.productPedidookId, { ...i, orderId }])).values()];
    if (items.length > 0) {
      await tx
        .insert(t.orderItems)
        .values(items)
        .onConflictDoUpdate({
          target: [t.orderItems.orderId, t.orderItems.productPedidookId],
          set: excludedSet(t.orderItems, Object.keys(items[0]).filter((k) => k !== "orderId" && k !== "productPedidookId")),
        });
    }
    // Itens que deixaram de vir no pedido são preservados como histórico, marcados como excluídos.
    const present = items.map((i) => i.productPedidookId);
    await tx
      .update(t.orderItems)
      .set({ deletedInSource: true })
      .where(
        present.length > 0
          ? and(eq(t.orderItems.orderId, orderId), notInArray(t.orderItems.productPedidookId, present))
          : eq(t.orderItems.orderId, orderId),
      );
  }
  return result;
}

// ------------------------------------------------------------------ registro

export const LIST_RESOURCES: Record<ListResourceKey, ListResource> = {
  vendedores: {
    key: "vendedores",
    label: RESOURCE_LABELS.vendedores,
    path: "vendedores",
    listKey: "vendedores",
    schema: vendedorSchema,
    table: t.sellers,
    upsert: simple<typeof vendedorSchema>(t.sellers, mapVendedor),
  },
  fornecedores: {
    key: "fornecedores",
    label: RESOURCE_LABELS.fornecedores,
    path: "fornecedores",
    listKey: "fornecedores",
    schema: fornecedorSchema,
    table: t.suppliers,
    upsert: simple<typeof fornecedorSchema>(t.suppliers, mapFornecedor),
  },
  produtos: {
    key: "produtos",
    label: RESOURCE_LABELS.produtos,
    path: "produtos",
    listKey: "produtos",
    schema: produtoSchema,
    table: t.products,
    upsert: simple<typeof produtoSchema>(t.products, mapProduto),
  },
  clientes: {
    key: "clientes",
    label: RESOURCE_LABELS.clientes,
    path: "clientes",
    listKey: "clientes",
    schema: clienteSchema,
    table: t.customers,
    upsert: simple<typeof clienteSchema>(t.customers, mapCliente),
  },
  condicoes_pagamento: {
    key: "condicoes_pagamento",
    label: RESOURCE_LABELS.condicoes_pagamento,
    path: "condicoes_pagamento",
    listKey: "condicoes_pagamento",
    schema: condicaoPagamentoSchema,
    table: t.paymentConditions,
    upsert: simple<typeof condicaoPagamentoSchema>(t.paymentConditions, mapCondicaoPagamento),
  },
  tabelas_preco: {
    key: "tabelas_preco",
    label: RESOURCE_LABELS.tabelas_preco,
    path: "tabelas_preco",
    listKey: "tabelas_preco",
    schema: tabelaPrecoSchema,
    table: t.priceTables,
    upsert: simple<typeof tabelaPrecoSchema>(t.priceTables, mapTabelaPreco),
  },
  pedidos: {
    key: "pedidos",
    label: RESOURCE_LABELS.pedidos,
    path: "pedidos",
    listKey: "pedidos",
    schema: pedidoSchema,
    table: t.orders,
    upsert: upsertPedidos as ListResource["upsert"],
  },
  cobrancas: {
    key: "cobrancas",
    label: RESOURCE_LABELS.cobrancas,
    path: "cobrancas",
    listKey: "cobrancas",
    schema: cobrancaSchema,
    table: t.receivables,
    upsert: simple<typeof cobrancaSchema>(t.receivables, mapCobranca),
  },
};

/** Liga as FKs internas (UUID) a partir dos IDs do PedidoOK, após cada sincronização. */
export async function resolveForeignKeys(db: Database | Tx) {
  await db.execute(sql`
    update products p set supplier_id = s.id from suppliers s
    where p.supplier_pedidook_id = s.pedidook_id and p.supplier_id is distinct from s.id`);
  await db.execute(sql`
    update orders o set customer_id = c.id from customers c
    where o.customer_pedidook_id = c.pedidook_id and o.customer_id is distinct from c.id`);
  await db.execute(sql`
    update orders o set seller_id = s.id from sellers s
    where o.seller_pedidook_id = s.pedidook_id and o.seller_id is distinct from s.id`);
  await db.execute(sql`
    update order_items i set product_id = p.id from products p
    where i.product_pedidook_id = p.pedidook_id and i.product_id is distinct from p.id`);
  await db.execute(sql`
    update receivables r set customer_id = c.id from customers c
    where r.customer_pedidook_id = c.pedidook_id and r.customer_id is distinct from c.id`);
  await db.execute(sql`
    update receivables r set order_id = o.id from orders o
    where r.order_pedidook_id = o.pedidook_id and r.order_id is distinct from o.id`);
  await db.execute(sql`
    update customer_sellers cs set seller_id = s.id from sellers s
    where cs.seller_pedidook_id = s.pedidook_id and cs.seller_id is distinct from s.id`);
}
