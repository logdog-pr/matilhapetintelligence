/** pnpm db:check — testa a conexão com o banco (sem exibir credenciais). */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada (.env.local).");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  const [r] = await sql`select current_user, version()`;
  const [t] = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
  console.log(`Conectado como ${r.current_user} · ${String(r.version).split(" ").slice(0, 2).join(" ")} · tabelas em public: ${t.n}`);
} catch (e) {
  console.error("Falha na conexão:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
