/** pnpm db:users-check — confere usuários do sistema x Supabase Auth (sem senhas). */
import { createClient } from "@supabase/supabase-js";
import { scriptDb } from "./_db.ts";

const { pool } = scriptDb();
const { rows } = await pool.query("select email, role, active, auth_user_id from users order by created_at");
await pool.end();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (error) console.log("Erro ao listar Auth:", error.message);
const authById = new Map((data?.users ?? []).map((u) => [u.id, u]));
console.log(`Usuários no sistema: ${rows.length} · no Supabase Auth: ${data?.users.length ?? "?"}`);
for (const r of rows) {
  const a = authById.get(r.auth_user_id);
  console.log(
    `- ${r.email} · ${r.role} · ${r.active ? "ativo" : "inativo"} · Auth: ${a ? `ok (confirmado: ${!!a.email_confirmed_at}, último login: ${a.last_sign_in_at ?? "nunca"})` : "NÃO ENCONTRADO"}`,
  );
}
for (const u of data?.users ?? []) if (!rows.some((r) => r.auth_user_id === u.id)) console.log(`- (só no Auth) ${u.email}`);
