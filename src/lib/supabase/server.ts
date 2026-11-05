import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Cliente Supabase com a sessão do usuário (cookies). */
export async function createSupabaseServerClient() {
  const url = env.supabaseUrl();
  const key = env.supabaseAnonKey();
  if (!url || !key) throw new Error("Supabase Auth não configurado.");
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Chamado a partir de Server Component: o middleware renova a sessão.
        }
      },
    },
  });
}

/** Cliente administrativo (service role) — somente servidor. */
export function createSupabaseAdminClient() {
  const url = env.supabaseUrl();
  const key = env.supabaseServiceRoleKey();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
