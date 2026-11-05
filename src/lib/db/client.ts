import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { pgPoolConfig } from "./pg-options";
import * as schema from "./schema";
import type { Database } from "./types";

let cached: Database | null = null;

/** Conexão com o PostgreSQL do Supabase (Transaction pooler, porta 6543). */
export function getDb(): Database {
  if (cached) return cached;
  const url = env.databaseUrl();
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const pool = new Pool(pgPoolConfig(url));
  pool.on("error", (e) => console.error("[db] erro em conexão ociosa:", e.message));
  cached = drizzle(pool, { schema }) as unknown as Database;
  return cached;
}
