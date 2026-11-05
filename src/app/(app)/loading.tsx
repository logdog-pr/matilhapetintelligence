import { DogRunner } from "@/components/goal-progress/DogRunner";

/** Carregamento das páginas internas: esqueletos + o cachorro andando. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6 space-y-2">
        <div className="skeleton h-7 w-64 rounded-lg" />
        <div className="skeleton h-4 w-96 max-w-full rounded" />
      </div>

      <div className="relative mb-6 overflow-hidden rounded-xl border border-navy-100 bg-white px-5 pb-5 pt-16">
        <div className="absolute left-0 top-4 w-full" style={{ animation: "dog-walk-across 2.6s linear infinite" }}>
          <DogRunner pose="run" />
        </div>
        <div className="skeleton h-4 w-full rounded-full" />
        <p className="mt-3 text-center text-xs text-muted">Buscando os números da matilha…</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-navy-100 bg-white p-5">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-7 w-32 rounded" />
            <div className="skeleton mt-3 h-3 w-40 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton mt-4 h-56 w-full rounded-lg" />
      </div>
    </div>
  );
}
