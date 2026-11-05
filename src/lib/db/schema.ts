/**
 * Schema do banco (PostgreSQL do Supabase) — Drizzle ORM.
 *
 * Convenções:
 * - `id` UUID interno; `pedidook_id` = ID original do PedidoOK (UNIQUE).
 * - `pedidook_updated_at` = campo `ultima_alteracao` da API, guardado como
 *   timestamp SEM fuso (relógio da fonte), pois a documentação não informa o fuso.
 * - `deleted_in_source` = campo `excluido` da API (registro preservado como histórico).
 * - `raw` = JSON original recebido, para auditoria e campos futuros.
 * - Dinheiro em NUMERIC(14,2); quantidades em NUMERIC(14,4). Nunca FLOAT.
 * - FKs internas (customer_id, seller_id…) são resolvidas a partir dos IDs do
 *   PedidoOK (*_pedidook_id) e podem ficar nulas até o registro pai ser importado.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 14, scale: 4 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const sourceUpdatedAt = () => timestamp("pedidook_updated_at", { mode: "string" });
const deletedInSource = () => boolean("deleted_in_source").notNull().default(false);
const raw = () => jsonb("raw");

// ---------------------------------------------------------------- enums

export const userRole = pgEnum("user_role", ["ADMIN", "GESTOR", "VENDEDOR"]);
export const goalPeriodKind = pgEnum("goal_period_kind", ["MENSAL", "SEMANAL", "PERSONALIZADO"]);
export const goalDayMode = pgEnum("goal_day_mode", ["CORRIDOS", "UTEIS"]);
export const syncStatus = pgEnum("sync_status", ["idle", "running", "partial", "success", "error"]);
export const syncMode = pgEnum("sync_mode", ["full", "incremental"]);

// ---------------------------------------------------------------- usuários

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: uuid("auth_user_id").unique(), // Supabase auth.users.id
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: userRole("role").notNull().default("VENDEDOR"),
    sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`), index("users_seller_idx").on(t.sellerId)],
);

// ---------------------------------------------------------------- cadastros PedidoOK

export const sellers = pgTable("sellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidookId: integer("pedidook_id").notNull().unique(),
  name: text("name").notNull(),
  region: text("region"),
  licenseValidUntil: date("license_valid_until"),
  active: boolean("active").notNull().default(true),
  deletedInSource: deletedInSource(),
  pedidookUpdatedAt: sourceUpdatedAt(),
  raw: raw(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidookId: integer("pedidook_id").notNull().unique(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj"),
  phone: text("phone"),
  email: text("email"),
  /** Prazo de entrega em dias — NÃO existe na API; configuração manual (Fase 3). */
  leadTimeDays: integer("lead_time_days"),
  active: boolean("active").notNull().default(true),
  deletedInSource: deletedInSource(),
  pedidookUpdatedAt: sourceUpdatedAt(),
  raw: raw(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidookId: integer("pedidook_id").notNull().unique(),
    code: text("code"),
    corporateName: text("corporate_name").notNull(),
    tradeName: text("trade_name"),
    cnpj: text("cnpj"),
    phone: text("phone"),
    email: text("email"),
    segment: text("segment"),
    street: text("street"),
    number: text("number"),
    district: text("district"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    creditLimit: money("credit_limit"),
    active: boolean("active").notNull().default(true),
    deletedInSource: deletedInSource(),
    pedidookUpdatedAt: sourceUpdatedAt(),
    /** Quando as associações cliente↔vendedor foram lidas pela última vez. */
    sellersSyncedAt: timestamp("sellers_synced_at", { withTimezone: true }),
    /** `pedidook_updated_at` do cliente no momento da última leitura das associações. */
    sellersSyncedVersion: timestamp("sellers_synced_version", { mode: "string" }),
    raw: raw(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customers_cnpj_idx").on(t.cnpj), index("customers_city_idx").on(t.city)],
);

/** Associação N:N cliente↔vendedor (GET /clientes/{id}/vendedores). */
export const customerSellers = pgTable(
  "customer_sellers",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    sellerPedidookId: integer("seller_pedidook_id").notNull(),
    sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.sellerPedidookId] }), index("customer_sellers_seller_idx").on(t.sellerId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidookId: integer("pedidook_id").notNull().unique(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category"),
    packaging: text("packaging"),
    packageQty: qty("package_qty"),
    salePrice: money("sale_price"),
    purchaseCost: money("purchase_cost"),
    currentStock: qty("current_stock"),
    minimumStock: qty("minimum_stock"),
    commissionPct: numeric("commission_pct", { precision: 7, scale: 4 }),
    expiresOn: date("expires_on"),
    supplierPedidookId: integer("supplier_pedidook_id"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    deletedInSource: deletedInSource(),
    pedidookUpdatedAt: sourceUpdatedAt(),
    raw: raw(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_sku_idx").on(t.sku), index("products_supplier_idx").on(t.supplierId)],
);

export const paymentConditions = pgTable("payment_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidookId: integer("pedidook_id").notNull().unique(),
  installmentsDays: jsonb("installments_days").$type<number[]>().notNull(),
  deletedInSource: deletedInSource(),
  pedidookUpdatedAt: sourceUpdatedAt(),
  raw: raw(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const priceTables = pgTable("price_tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidookId: integer("pedidook_id").notNull().unique(),
  name: text("name").notNull(),
  inactive: boolean("inactive").notNull().default(false),
  deletedInSource: deletedInSource(),
  pedidookUpdatedAt: sourceUpdatedAt(),
  raw: raw(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------- pedidos

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidookId: integer("pedidook_id").notNull().unique(),
    number: integer("number"),
    customerPedidookId: integer("customer_pedidook_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    sellerPedidookId: integer("seller_pedidook_id").notNull(),
    sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "set null" }),
    /** emissao */
    orderDate: date("order_date").notNull(),
    /** faturamento */
    billingDate: date("billing_date"),
    /** status: pedido | orcamento | bonificacao | troca */
    status: text("status").notNull(),
    /** situacao: pendente | faturado | pago | concluido | separado | entregue (normalizado minúsculo) */
    situation: text("situation"),
    /** Σ quantidade × preco_bruto dos itens ativos */
    grossAmount: money("gross_amount").notNull(),
    /** gross − net (positivo = desconto) */
    discountAmount: money("discount_amount").notNull(),
    /** Σ quantidade × preco_liquido + ajuste do cabeçalho (sem frete) */
    netAmount: money("net_amount").notNull(),
    /** Σ quantidade × preco_custo (custo histórico do momento da venda) */
    costAmount: money("cost_amount"),
    freightAmount: money("freight_amount"),
    headerAdjustmentType: text("header_adjustment_type"),
    headerAdjustmentValue: numeric("header_adjustment_value", { precision: 14, scale: 4 }),
    paymentConditionPedidookId: integer("payment_condition_pedidook_id"),
    paymentMethod: text("payment_method"),
    priceTablePedidookId: integer("price_table_pedidook_id"),
    source: text("source").notNull().default("pedidook"),
    deletedInSource: deletedInSource(),
    pedidookUpdatedAt: sourceUpdatedAt(),
    raw: raw(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_order_date_idx").on(t.orderDate),
    index("orders_customer_idx").on(t.customerId),
    index("orders_seller_idx").on(t.sellerId),
    index("orders_status_idx").on(t.status),
    index("orders_customer_pid_idx").on(t.customerPedidookId),
    index("orders_seller_pid_idx").on(t.sellerPedidookId),
  ],
);

/** Itens não têm ID próprio na API: chave = (pedido, id_produto). */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productPedidookId: integer("product_pedidook_id").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    quantity: qty("quantity").notNull(),
    packaging: text("packaging"),
    packageQty: qty("package_qty"),
    grossUnitPrice: money("gross_unit_price"),
    /** preco_liquido */
    unitPrice: money("unit_price").notNull(),
    /** preco_custo no momento da venda — nunca substituído pelo custo atual */
    unitCostSnapshot: money("unit_cost_snapshot"),
    discountPct: numeric("discount_pct", { precision: 9, scale: 4 }),
    totalAmount: money("total_amount").notNull(),
    grossMargin: money("gross_margin"),
    deletedInSource: deletedInSource(),
    pedidookUpdatedAt: sourceUpdatedAt(),
    raw: raw(),
  },
  (t) => [
    uniqueIndex("order_items_order_product_uq").on(t.orderId, t.productPedidookId),
    index("order_items_product_idx").on(t.productId),
  ],
);

// ---------------------------------------------------------------- cobranças

export const receivables = pgTable(
  "receivables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidookId: integer("pedidook_id").notNull().unique(),
    customerPedidookId: integer("customer_pedidook_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderPedidookId: integer("order_pedidook_id"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    reference: text("reference"),
    dueDate: date("due_date").notNull(),
    paymentDate: date("payment_date"),
    amount: money("amount").notNull(),
    amountPaid: money("amount_paid"),
    discount: money("discount"),
    interest: money("interest"),
    fine: money("fine"),
    surcharge: money("surcharge"),
    paymentMethod: text("payment_method"),
    deletedInSource: deletedInSource(),
    pedidookUpdatedAt: sourceUpdatedAt(),
    raw: raw(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("receivables_due_date_idx").on(t.dueDate),
    index("receivables_customer_idx").on(t.customerId),
    index("receivables_customer_pid_idx").on(t.customerPedidookId),
  ],
);

// ---------------------------------------------------------------- metas

export const salesGoals = pgTable(
  "sales_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** nulo = meta da empresa */
    sellerId: uuid("seller_id").references(() => sellers.id, { onDelete: "cascade" }),
    periodKind: goalPeriodKind("period_kind").notNull().default("MENSAL"),
    dayMode: goalDayMode("day_mode").notNull().default("CORRIDOS"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    targetRevenue: money("target_revenue"),
    targetOrders: integer("target_orders"),
    targetNewCustomers: integer("target_new_customers"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sales_goals_seller_idx").on(t.sellerId), index("sales_goals_period_idx").on(t.periodStart, t.periodEnd)],
);

// ---------------------------------------------------------------- estoque

export const stockSnapshots = pgTable(
  "stock_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: qty("quantity"),
    snapshotDate: date("snapshot_date").notNull(),
    source: text("source").notNull().default("pedidook_sync"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("stock_snapshots_product_date_uq").on(t.productId, t.snapshotDate)],
);

/** A API NÃO fornece movimentações. Tabela reservada para fontes futuras. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    movementType: text("movement_type").notNull(),
    quantity: qty("quantity").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    movementDate: timestamp("movement_date", { withTimezone: true }).notNull(),
    source: text("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
);

// ---------------------------------------------------------------- inteligência (fases futuras)

/**
 * Sugestões do motor de promoções (spec §12). Nunca alteram preços no PedidoOK.
 * status: sugerida | aprovada | rejeitada. Valores congelados no momento da geração.
 */
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    /** Venda casada: produto âncora (quem leva este, leva o productId). */
    relatedProductId: uuid("related_product_id").references(() => products.id, { onDelete: "cascade" }),
    promotionType: text("promotion_type").notNull(),
    situation: text("situation"),
    currentStock: qty("current_stock"),
    unitCost: money("unit_cost"),
    currentPrice: money("current_price"),
    suggestedPrice: money("suggested_price"),
    discountPct: numeric("discount_pct", { precision: 7, scale: 4 }),
    /** Margem estimada após o preço sugerido (%). */
    minimumMargin: numeric("minimum_margin", { precision: 7, scale: 4 }),
    estimatedQuantity: qty("estimated_quantity"),
    estimatedRevenue: money("estimated_revenue"),
    estimatedProfit: money("estimated_profit"),
    capitalFreed: money("capital_freed"),
    impactEstimate: money("impact_estimate"),
    reasoning: text("reasoning"),
    status: text("status").notNull().default("sugerida"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: createdAt(),
  },
  (t) => [index("promotions_status_idx").on(t.status, t.createdAt), index("promotions_product_idx").on(t.productId)],
);

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(3),
  impactEstimate: money("impact_estimate"),
  relatedProductId: uuid("related_product_id").references(() => products.id, { onDelete: "set null" }),
  relatedCustomerId: uuid("related_customer_id").references(() => customers.id, { onDelete: "set null" }),
  relatedSellerId: uuid("related_seller_id").references(() => sellers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("aberta"),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// ---------------------------------------------------------------- sincronização

export const syncCursors = pgTable("sync_cursors", {
  resource: text("resource").primaryKey(),
  /** Último término com sucesso (relógio do nosso servidor). */
  lastSuccessfulSync: timestamp("last_successful_sync", { withTimezone: true }),
  /** Maior `ultima_alteracao` já processada (relógio da fonte, sem fuso). */
  sourceWatermark: timestamp("source_watermark", { mode: "string" }),
  /** Execução em andamento (retomável). */
  runMode: syncMode("run_mode"),
  runStartedAt: timestamp("run_started_at", { withTimezone: true }),
  nextPageUrl: text("next_page_url"),
  lastPage: integer("last_page"),
  pendingWatermark: timestamp("pending_watermark", { mode: "string" }),
  runRecordsRead: integer("run_records_read").notNull().default(0),
  runLogId: uuid("run_log_id"),
  status: syncStatus("status").notNull().default("idle"),
  /** Lease de concorrência: só uma execução por recurso. */
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: updatedAt(),
});

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resource: text("resource").notNull(),
    mode: syncMode("mode").notNull(),
    trigger: text("trigger").notNull().default("cron"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    recordsRead: integer("records_read").notNull().default(0),
    recordsCreated: integer("records_created").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    requestsMade: integer("requests_made").notNull().default(0),
    /** Validação de contagem ao fim de uma importação completa. */
    countCheck: jsonb("count_check"),
    errors: jsonb("errors").$type<string[]>().notNull().default([]),
    status: syncStatus("status").notNull().default("running"),
  },
  (t) => [index("sync_logs_resource_idx").on(t.resource, t.startedAt)],
);

/** Contador diário de requisições à API (limite 20.000/dia por token_pedidook). */
export const apiRequestCounters = pgTable("api_request_counters", {
  day: date("day").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------- configurações e auditoria

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_user_idx").on(t.userId, t.createdAt)],
);

// ---------------------------------------------------------------- IA (Fase 6)

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  createdAt: createdAt(),
});

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: createdAt(),
});

export type UserRole = (typeof userRole.enumValues)[number];
