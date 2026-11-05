-- Supabase expõe o schema public pela API REST (PostgREST) usando a anon key,
-- que é pública no navegador. RLS ligado SEM políticas = API pública não lê nem escreve nada.
-- O servidor do Pet Intelligence conecta como dono das tabelas e não é afetado.
ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_request_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_sellers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_conditions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "price_tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receivables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sellers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_cursors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
