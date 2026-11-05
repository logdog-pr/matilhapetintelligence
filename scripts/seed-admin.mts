/**
 * pnpm seed:admin -- --email voce@empresa.com --name "Seu Nome"
 * Cria (ou promove) o primeiro administrador no Supabase Auth e no banco.
 * A senha é pedida no terminal sem aparecer na tela (ou via --password).
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { parseArgs } from "node:util";
import { users } from "../src/lib/db/schema";
import { scriptDb } from "./_db.ts";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" } },
});
if (!values.email || !values.name) {
  console.error('Uso: pnpm seed:admin -- --email a@b.com --name "Nome"');
  process.exit(1);
}

const ENTER = new Set(["\r", "\n"]);
const CTRL_C = "\u0003";
const BACKSPACE = new Set(["\u007f", "\b"]);

/** Lê a senha sem ecoar os caracteres. */
async function askHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error("Terminal não interativo: use --password.");
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (ENTER.has(c)) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === CTRL_C) process.exit(130);
        if (BACKSPACE.has(c)) value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

let password = values.password;
if (!password) {
  const first = await askHidden("Senha (mínimo 10 caracteres): ");
  const second = await askHidden("Confirme a senha: ");
  if (first !== second) {
    console.error("As senhas não conferem.");
    process.exit(1);
  }
  password = first;
}
if (password.length < 10) {
  console.error("A senha precisa ter ao menos 10 caracteres.");
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
const email = values.email.trim().toLowerCase();

let authId: string | undefined;
const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (created.data.user) {
  authId = created.data.user.id;
} else {
  // já existe no Supabase: localiza e atualiza a senha
  const list = await supabase.auth.admin.listUsers({ perPage: 1000 });
  authId = list.data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!authId) {
    console.error("Falha ao criar usuário no Supabase:", created.error?.message);
    process.exit(1);
  }
  await supabase.auth.admin.updateUserById(authId, { password });
}

await db
  .insert(users)
  .values({ authUserId: authId, email, name: values.name, role: "ADMIN", active: true })
  .onConflictDoUpdate({ target: users.authUserId, set: { role: "ADMIN", active: true, name: values.name, updatedAt: sql`now()` } });

console.log(`Administrador pronto: ${email}`);
await pool.end();
