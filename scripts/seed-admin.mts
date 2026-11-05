/**
 * pnpm seed:admin -- --email voce@empresa.com --name "Seu Nome" --password "senha-forte"
 * Cria (ou promove) o primeiro administrador no Supabase Auth e no banco.
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { parseArgs } from "node:util";
import { users } from "../src/lib/db/schema";
import { scriptDb } from "./_db.ts";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" } },
});
if (!values.email || !values.name || !values.password || values.password.length < 10) {
  console.error('Uso: pnpm seed:admin -- --email a@b.com --name "Nome" --password "mínimo 10 caracteres"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { db, pool } = scriptDb();
if (!url || !key) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let authId: string | undefined;
const created = await supabase.auth.admin.createUser({ email: values.email, password: values.password, email_confirm: true });
if (created.data.user) authId = created.data.user.id;
else {
  // já existe no Supabase: localiza
  const list = await supabase.auth.admin.listUsers({ perPage: 1000 });
  authId = list.data.users.find((u) => u.email?.toLowerCase() === values.email!.toLowerCase())?.id;
  if (!authId) {
    console.error("Falha ao criar usuário no Supabase:", created.error?.message);
    process.exit(1);
  }
}

await db
  .insert(users)
  .values({ authUserId: authId, email: values.email, name: values.name, role: "ADMIN", active: true })
  .onConflictDoUpdate({ target: users.authUserId, set: { role: "ADMIN", active: true, name: values.name, updatedAt: sql`now()` } });

console.log(`Administrador pronto: ${values.email}`);
await pool.end();
