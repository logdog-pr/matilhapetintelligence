import { AppShell } from "@/components/layout/AppShell";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getSyncHealth } from "@/lib/queries/sync-health";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const health = await getSyncHealth(getDb());
  const ordersSync = health.resources.find((r) => r.resource === "pedidos")?.lastSuccessfulSync ?? null;

  return (
    <AppShell role={user.role} name={user.name} freshness={health.overall} lastSync={ordersSync}>
      {children}
    </AppShell>
  );
}
