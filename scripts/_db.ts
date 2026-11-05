import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgPoolConfig } from "../src/lib/db/pg-options";
import * as schema from "../src/lib/db/schema";
import type { Database } from "../src/lib/db/types";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export function scriptDb(): { db: Database; pool: pg.Pool } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não configurada (.env.local).");
    process.exit(1);
  }
  const pool = new pg.Pool(pgPoolConfig(url, 3));
  return { db: drizzle(pool, { schema }) as unknown as Database, pool };
}
