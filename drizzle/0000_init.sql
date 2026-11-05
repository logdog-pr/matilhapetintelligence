CREATE TYPE "public"."goal_day_mode" AS ENUM('CORRIDOS', 'UTEIS');--> statement-breakpoint
CREATE TYPE "public"."goal_period_kind" AS ENUM('MENSAL', 'SEMANAL', 'PERSONALIZADO');--> statement-breakpoint
CREATE TYPE "public"."sync_mode" AS ENUM('full', 'incremental');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'running', 'partial', 'success', 'error');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'GESTOR', 'VENDEDOR');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_counters" (
	"day" date PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sellers" (
	"customer_id" uuid NOT NULL,
	"seller_pedidook_id" integer NOT NULL,
	"seller_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sellers_customer_id_seller_pedidook_id_pk" PRIMARY KEY("customer_id","seller_pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"code" text,
	"corporate_name" text NOT NULL,
	"trade_name" text,
	"cnpj" text,
	"phone" text,
	"email" text,
	"segment" text,
	"street" text,
	"number" text,
	"district" text,
	"city" text,
	"state" text,
	"zip" text,
	"credit_limit" numeric(14, 2),
	"active" boolean DEFAULT true NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"sellers_synced_at" timestamp with time zone,
	"sellers_synced_version" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_pedidook_id" integer NOT NULL,
	"product_id" uuid,
	"quantity" numeric(14, 4) NOT NULL,
	"packaging" text,
	"package_qty" numeric(14, 4),
	"gross_unit_price" numeric(14, 2),
	"unit_price" numeric(14, 2) NOT NULL,
	"unit_cost_snapshot" numeric(14, 2),
	"discount_pct" numeric(9, 4),
	"total_amount" numeric(14, 2) NOT NULL,
	"gross_margin" numeric(14, 2),
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"number" integer,
	"customer_pedidook_id" integer NOT NULL,
	"customer_id" uuid,
	"seller_pedidook_id" integer NOT NULL,
	"seller_id" uuid,
	"order_date" date NOT NULL,
	"billing_date" date,
	"status" text NOT NULL,
	"situation" text,
	"gross_amount" numeric(14, 2) NOT NULL,
	"discount_amount" numeric(14, 2) NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"cost_amount" numeric(14, 2),
	"freight_amount" numeric(14, 2),
	"header_adjustment_type" text,
	"header_adjustment_value" numeric(14, 4),
	"payment_condition_pedidook_id" integer,
	"payment_method" text,
	"price_table_pedidook_id" integer,
	"source" text DEFAULT 'pedidook' NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "payment_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"installments_days" jsonb NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_conditions_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "price_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"name" text NOT NULL,
	"inactive" boolean DEFAULT false NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_tables_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"packaging" text,
	"package_qty" numeric(14, 4),
	"sale_price" numeric(14, 2),
	"purchase_cost" numeric(14, 2),
	"current_stock" numeric(14, 4),
	"minimum_stock" numeric(14, 4),
	"commission_pct" numeric(7, 4),
	"expires_on" date,
	"supplier_pedidook_id" integer,
	"supplier_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"promotion_type" text NOT NULL,
	"suggested_price" numeric(14, 2),
	"minimum_margin" numeric(7, 4),
	"estimated_quantity" numeric(14, 4),
	"estimated_revenue" numeric(14, 2),
	"estimated_profit" numeric(14, 2),
	"reasoning" text,
	"status" text DEFAULT 'sugerida' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"customer_pedidook_id" integer NOT NULL,
	"customer_id" uuid,
	"order_pedidook_id" integer,
	"order_id" uuid,
	"reference" text,
	"due_date" date NOT NULL,
	"payment_date" date,
	"amount" numeric(14, 2) NOT NULL,
	"amount_paid" numeric(14, 2),
	"discount" numeric(14, 2),
	"interest" numeric(14, 2),
	"fine" numeric(14, 2),
	"surcharge" numeric(14, 2),
	"payment_method" text,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivables_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"impact_estimate" numeric(14, 2),
	"related_product_id" uuid,
	"related_customer_id" uuid,
	"related_seller_id" uuid,
	"status" text DEFAULT 'aberta' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid,
	"period_kind" "goal_period_kind" DEFAULT 'MENSAL' NOT NULL,
	"day_mode" "goal_day_mode" DEFAULT 'CORRIDOS' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target_revenue" numeric(14, 2),
	"target_orders" integer,
	"target_new_customers" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"license_valid_until" date,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"movement_date" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 4),
	"snapshot_date" date NOT NULL,
	"source" text DEFAULT 'pedidook_sync' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedidook_id" integer NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"cnpj" text,
	"phone" text,
	"email" text,
	"lead_time_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_in_source" boolean DEFAULT false NOT NULL,
	"pedidook_updated_at" timestamp,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_pedidook_id_unique" UNIQUE("pedidook_id")
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"resource" text PRIMARY KEY NOT NULL,
	"last_successful_sync" timestamp with time zone,
	"source_watermark" timestamp,
	"run_mode" "sync_mode",
	"run_started_at" timestamp with time zone,
	"next_page_url" text,
	"last_page" integer,
	"pending_watermark" timestamp,
	"run_records_read" integer DEFAULT 0 NOT NULL,
	"run_log_id" uuid,
	"status" "sync_status" DEFAULT 'idle' NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" text NOT NULL,
	"mode" "sync_mode" NOT NULL,
	"trigger" text DEFAULT 'cron' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"requests_made" integer DEFAULT 0 NOT NULL,
	"count_check" jsonb,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'VENDEDOR' NOT NULL,
	"seller_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sellers" ADD CONSTRAINT "customer_sellers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sellers" ADD CONSTRAINT "customer_sellers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_related_customer_id_customers_id_fk" FOREIGN KEY ("related_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_related_seller_id_sellers_id_fk" FOREIGN KEY ("related_seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_snapshots" ADD CONSTRAINT "stock_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_sellers_seller_idx" ON "customer_sellers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "customers_cnpj_idx" ON "customers" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "customers_city_idx" ON "customers" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_order_product_uq" ON "order_items" USING btree ("order_id","product_pedidook_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_order_date_idx" ON "orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_seller_idx" ON "orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_customer_pid_idx" ON "orders" USING btree ("customer_pedidook_id");--> statement-breakpoint
CREATE INDEX "orders_seller_pid_idx" ON "orders" USING btree ("seller_pedidook_id");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_supplier_idx" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "receivables_due_date_idx" ON "receivables" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "receivables_customer_idx" ON "receivables" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "receivables_customer_pid_idx" ON "receivables" USING btree ("customer_pedidook_id");--> statement-breakpoint
CREATE INDEX "sales_goals_seller_idx" ON "sales_goals" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "sales_goals_period_idx" ON "sales_goals" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_snapshots_product_date_uq" ON "stock_snapshots" USING btree ("product_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "sync_logs_resource_idx" ON "sync_logs" USING btree ("resource","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_seller_idx" ON "users" USING btree ("seller_id");