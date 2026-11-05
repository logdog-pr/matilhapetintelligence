"use client";

import { LogOut, Menu } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import type { Role } from "@/lib/auth/rbac";
import type { Freshness } from "@/lib/queries/sync-health";
import { Toaster } from "@/components/ui/Toaster";
import { GlobalSearch } from "./GlobalSearch";
import { RouteProgress } from "./RouteProgress";
import { Sidebar } from "./Sidebar";
import { SyncStatusBadge } from "./SyncStatusBadge";

const STORAGE_KEY = "matilha:sidebar-recolhida";

/** Moldura interativa: sidebar (recolhível/menu no celular), barra superior, progresso de navegação e notificações. */
export function AppFrame({
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Suspense>
        <RouteProgress />
      </Suspense>
      <Sidebar role={role} name={name} collapsed={collapsed} onToggleCollapsed={toggle} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-navy-100 px-4 sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="grid h-8 w-8 place-items-center rounded-md text-navy-700 hover:bg-navy-50 lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch role={role} />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:inline-flex">
              <SyncStatusBadge freshness={freshness} lastSync={lastSync} />
            </span>
            <form action="/auth/signout" method="post">
              <button className="grid h-8 w-8 place-items-center rounded-md text-navy-700 transition-colors hover:bg-navy-50" title="Sair" aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-navy-50/40 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
