import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Tipo comum ao Supabase/postgres-js (produção) e ao PGlite (testes). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
