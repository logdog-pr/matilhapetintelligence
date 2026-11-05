/** pnpm db:rls-check — confirma RLS ligado e que a API pública (anon) não lê dados. */
import { scriptDb } from "./_db.ts";

const { pool } = scriptDb();
const { rows } = await pool.query<{ relname: string; relrowsecurity: boolean }>(
  "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
);
await pool.end();
const off = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
console.log(`RLS: ${rows.length - off.length}/${rows.length} tabelas protegidas${off.length ? ` · SEM RLS: ${off.join(", ")}` : ""}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (url && key) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/users?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const body = await res.text();
  const exposed = res.ok && body.trim() !== "[]";
  console.log(`API pública (anon) em /users: HTTP ${res.status} · ${exposed ? "⚠ DADOS EXPOSTOS" : "nenhum dado retornado (protegido)"}`);
}
process.exitCode = off.length ? 1 : 0;
