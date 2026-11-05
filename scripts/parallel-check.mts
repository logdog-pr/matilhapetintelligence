/** pnpm db:parallel-check — garante que consultas simultâneas não travam no pooler do Supabase. */
import { count } from "drizzle-orm";
import { products, syncCursors } from "../src/lib/db/schema";
import { scriptDb } from "./_db.ts";

const { db, pool } = scriptDb();
const start = Date.now();
const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("travou (>15s)")), 15_000));
try {
  await Promise.race([
    Promise.all([...Array.from({ length: 12 }, () => db.select({ n: count() }).from(products)), db.select().from(syncCursors)]),
    timeout,
  ]);
  await db.transaction(async (tx) => {
    await tx.select().from(syncCursors).limit(1);
  });
  console.log(`13 consultas simultâneas + transação: OK (${Date.now() - start}ms)`);
} catch (e) {
  console.error("FALHA:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
  setTimeout(() => process.exit(), 100).unref();
}
