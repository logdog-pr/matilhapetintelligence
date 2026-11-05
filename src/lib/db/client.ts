import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";
import { env } from "@/lib/env";

let cached: Database | null = null;

/**
 * Conexão com o PostgreSQL do Supabase.
 * Use a connection string do "Transaction pooler" (porta 6543): ideal para serverless.
 * `prepare: false` é obrigatório nesse modo do pooler.
 */
export function getDb(): Database {
  if (cached) return cached;
  const url = env.databaseUrl();
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const client = postgres(url, { prepare: false, max: 5 });
  cached = drizzle(client, { schema }) as unknown as Database;
  return cached;
}
