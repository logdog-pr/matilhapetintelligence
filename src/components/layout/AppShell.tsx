import { LogOut } from "lucide-react";
import type { Role } from "@/lib/auth/rbac";
import type { Freshness } from "@/lib/queries/sync-health";
import { GlobalSearch } from "./GlobalSearch";
import { Sidebar } from "./Sidebar";
import { SyncStatusBadge } from "./SyncStatusBadge";

/** Estrutura das páginas internas: sidebar azul-marinho + barra superior + conteúdo. */
export function AppShell({
  role,
  name,
  freshness,
  lastSync,
  children,
}: {
  role: Role;
  name: string;
  freshness: Freshness;
  lastSync: Date | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar role={role} name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-navy-100 px-6">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <SyncStatusBadge freshness={freshness} lastSync={lastSync} />
            <form action="/auth/signout" method="post">
              <button className="grid h-8 w-8 place-items-center rounded-md text-navy-700 transition-colors hover:bg-navy-50" title="Sair" aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-navy-50/40 px-6 py-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
