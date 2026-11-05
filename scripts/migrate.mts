/** pnpm db:migrate — aplica as migrations de ./drizzle no PostgreSQL do Supabase. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { scriptDb } from "./_db.ts";

const { db, pool } = scriptDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await migrate(db as any, { migrationsFolder: "./drizzle" });
console.log("Migrations aplicadas.");
await pool.end();
