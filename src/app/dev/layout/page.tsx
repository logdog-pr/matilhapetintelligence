import { Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";
import { GoalProgress } from "@/components/goal-progress/GoalProgress";
import { AppShell } from "@/components/layout/AppShell";
import { Kpi } from "@/components/ui/Kpi";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { computeGoalProgress } from "@/lib/metrics/goals";

/**
 * Demonstração do layout completo — SOMENTE em desenvolvimento.
 * Valores fixos de EXEMPLO, não são dados da empresa.
 */
export default function LayoutPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const base = { periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-18" };

  return (
    <AppShell role="ADMIN" name="Administrador (exemplo)" freshness="atualizado" lastSync={new Date()}>
      <div className="animate-rise mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning">
        Exemplo visual: valores fictícios para conferência do layout. Esta página não existe em produção.
      </div>
      <PageHeader title="Dashboard geral" description="Novembro de 2026 · faturamento de pedidos por data de emissão" actions={<Badge tone="success">Exemplo</Badge>} />
      <div className="space-y-6">
        <GoalProgress
          title="Meta de faturamento da empresa"
          subtitle="01/11/2026 a 30/11/2026"
          progress={computeGoalProgress({ ...base, target: 150000, realized: 93000 })}
          extras={[{ label: "Pedidos", value: "214 de 320" }]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Faturamento do mês" value={93000} format="brl" icon={TrendingUp} hint="exemplo" />
          <Kpi label="Pedidos realizados" value={214} icon={ShoppingBag} delay={80} />
          <Kpi label="Ticket médio" value={434.58} format="brl" icon={Receipt} delay={160} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <GoalProgress title="1º · Vendedor A (exemplo)" progress={computeGoalProgress({ ...base, target: 40000, realized: 46500 })} size="md" />
          <GoalProgress title="2º · Vendedor B (exemplo)" progress={computeGoalProgress({ ...base, target: 50000, realized: 27500 })} size="md" />
        </div>
      </div>
    </AppShell>
  );
}
