/** pnpm db:check — testa a conexão com o banco (sem exibir credenciais). */
import type { TLSSocket } from "node:tls";
import { scriptDb } from "./_db.ts";

const { pool } = scriptDb();
try {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "select current_user, version(), (select count(*)::int from information_schema.tables where table_schema = 'public') as n",
    );
    const row = r.rows[0];
    // TLS do NOSSO lado (aplicação → pooler do Supabase)
    const socket = (client as unknown as { connection: { stream: TLSSocket } }).connection.stream;
    const tls = socket.encrypted
      ? `TLS ${socket.getProtocol()} · certificado ${socket.authorized ? "verificado" : "NÃO verificado"} (${socket.getPeerCertificate()?.issuer?.CN ?? "?"})`
      : "sem TLS";
    console.log(`Conectado como ${row.current_user} · ${String(row.version).split(" ").slice(0, 2).join(" ")} · tabelas em public: ${row.n} · ${tls}`);
  } finally {
    client.release();
  }
} catch (e) {
  console.error("Falha na conexão:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
