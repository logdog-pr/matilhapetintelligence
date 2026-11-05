ALTER TABLE "promotions" ADD COLUMN "related_product_id" uuid;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "situation" text;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "current_stock" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "unit_cost" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "current_price" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "discount_pct" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "capital_freed" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "impact_estimate" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "decision_note" text;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotions_status_idx" ON "promotions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "promotions_product_idx" ON "promotions" USING btree ("product_id");