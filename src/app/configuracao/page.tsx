import { CheckCircle2, Circle } from "lucide-react";
import type { Metadata } from "next";
import { DogRunner } from "@/components/goal-progress/DogRunner";
import { Logo } from "@/components/layout/Logo";
import { configStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Configuração" };
export const dynamic = "force-dynamic";

/** Página exibida enquanto as credenciais não estão configuradas. Não mostra valores, só presença. */
export default function SetupPage() {
  const cfg = configStatus();
  const items = [
    { ok: cfg.database, title: "Banco de dados (Supabase PostgreSQL)", vars: "DATABASE_URL", next: "Depois rode: pnpm db:migrate" },
    { ok: cfg.auth, title: "Autenticação (Supabase)", vars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY", next: "Depois rode: pnpm seed:admin" },
    { ok: cfg.pedidook, title: "Integração PedidoOK", vars: "PEDIDOOK_TOKEN_PARCEIRO, PEDIDOOK_TOKEN", next: "Depois: Integração → Importação histórica" },
  ];
  return (
    <main className="min-h-screen bg-navy-50">
      <header className="bg-navy-900 px-8 py-5">
        <Logo />
      </header>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center gap-4">
          <DogRunner pose="sit" />
          <div>
            <h1 className="text-xl font-semibold text-navy-950">Configuração pendente</h1>
            <p className="mt-1 text-sm text-muted">
              O sistema está instalado, mas ainda faltam credenciais. Nenhum dado é exibido até a conexão com as fontes oficiais.
            </p>
          </div>
        </div>
        <ul className="mt-8 space-y-3">
          {items.map((i) => (
            <li key={i.title} className="flex gap-3 rounded-xl border border-navy-100 bg-white p-4">
              {i.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-navy-300" />}
              <div>
                <p className="text-sm font-medium text-navy-950">
                  {i.title} {i.ok ? <span className="text-success">— configurado</span> : <span className="text-muted">— pendente</span>}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">{i.vars}</p>
                {!i.ok && <p className="mt-1 text-xs text-muted">{i.next}</p>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">
          Preencha o arquivo <code>.env.local</code> (veja <code>.env.example</code> e o README) e reinicie o servidor.
        </p>
      </div>
    </main>
  );
}
