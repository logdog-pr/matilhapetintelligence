import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import type { Database } from "../src/lib/db/types";

config({ path: ".env.local" });
config();

export function scriptDb(): { db: Database; pool: { end: () => Promise<void> } } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não configurada (.env.local).");
    process.exit(1);
  }
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  return { db: drizzle(client, { schema }) as unknown as Database, pool: { end: () => client.end() } };
}
