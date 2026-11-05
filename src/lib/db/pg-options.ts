import type { PoolConfig } from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-ca";

/**
 * Opções do pool do node-postgres para o Supabase.
 * - Funciona com o "Transaction pooler" (porta 6543): o pg não faz pipelining,
 *   que trava nesse modo do pooler (motivo da troca do postgres-js).
 * - SSL com verificação COMPLETA do certificado, usando a CA raiz do Supabase
 *   (Project Settings → Database → SSL Configuration → Download certificate).
 * - Para localhost (testes/desenvolvimento), sem SSL.
 */
export function pgPoolConfig(connectionString: string, max = 5): PoolConfig {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  return {
    connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ""),
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? false : { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
  };
}
