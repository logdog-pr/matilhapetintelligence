import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Tipo comum ao Supabase/node-postgres (produção) e ao PGlite (testes). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
