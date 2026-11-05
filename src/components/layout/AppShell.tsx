import type { Role } from "@/lib/auth/rbac";
import type { Freshness } from "@/lib/queries/sync-health";
import { AppFrame } from "./AppFrame";

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
    <AppFrame role={role} name={name} freshness={freshness} lastSync={lastSync}>
      {children}
    </AppFrame>
  );
}
