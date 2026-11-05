import { notFound } from "next/navigation";
import { GoalEmpty, GoalProgress } from "@/components/goal-progress/GoalProgress";
import { DogRunner } from "@/components/goal-progress/DogRunner";
import { computeGoalProgress } from "@/lib/metrics/goals";

/**
 * Vitrine de componentes — SOMENTE em desenvolvimento.
 * Valores abaixo são EXEMPLOS VISUAIS fixos, não dados da empresa.
 */
export default function ComponentsPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const base = { periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-18" };
  const exemplo = (target: number, realized: number) => computeGoalProgress({ ...base, target, realized });

  return (
    <main className="min-h-screen bg-navy-50/40 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning">
          Exemplo visual — valores fictícios apenas para conferência do componente. Esta página não existe em produção.
        </div>
        <h1 className="text-xl font-semibold text-navy-950">Barra de meta · Matilha</h1>
        <GoalProgress title="Exemplo · 62% da meta" subtitle="Mensal · 01/11/2026 a 30/11/2026" progress={exemplo(150000, 93000)} />
        <div className="grid gap-4 md:grid-cols-2">
          <GoalProgress title="Exemplo · 18%" progress={exemplo(40000, 7200)} size="md" />
          <GoalProgress title="Exemplo · meta batida" progress={exemplo(40000, 46500)} size="md" />
        </div>
        <GoalEmpty title="Estado vazio" message="Nenhuma meta mensal cadastrada." />
        <div className="flex items-end gap-8 rounded-xl border border-navy-100 bg-white p-6">
          <DogRunner pose="run" />
          <DogRunner pose="sit" />
          <DogRunner pose="sit" celebrate />
        </div>
      </div>
    </main>
  );
}
