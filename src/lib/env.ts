/**
 * Leitura centralizada de variáveis de ambiente (somente servidor).
 * Os tokens do PedidoOK e chaves de serviço NUNCA devem ir ao frontend.
 */
const read = (key: string) => {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export const env = {
  databaseUrl: () => read("DATABASE_URL"),
  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),
  pedidookTokenParceiro: () => read("PEDIDOOK_TOKEN_PARCEIRO"),
  pedidookToken: () => read("PEDIDOOK_TOKEN"),
  cronSecret: () => read("CRON_SECRET"),
  anthropicApiKey: () => read("ANTHROPIC_API_KEY"),
  openaiApiKey: () => read("OPENAI_API_KEY"),
};

export type ConfigStatus = { database: boolean; auth: boolean; pedidook: boolean };

export function configStatus(): ConfigStatus {
  return {
    database: !!env.databaseUrl(),
    auth: !!(env.supabaseUrl() && env.supabaseAnonKey()),
    pedidook: !!(env.pedidookTokenParceiro() && env.pedidookToken()),
  };
}
