import type { Freshness } from "@/lib/queries/sync-health";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const LABEL: Record<Freshness, string> = {
  atualizado: "Dados atualizados",
  parcial: "Sincronização parcial",
  desatualizado: "Dados desatualizados",
  indisponivel: "Dados indisponíveis",
};

const DOT: Record<Freshness, string> = {
  atualizado: "bg-success",
  parcial: "bg-warning",
  desatualizado: "bg-warning",
  indisponivel: "bg-navy-300",
};

export function SyncStatusBadge({ freshness, lastSync }: { freshness: Freshness; lastSync?: Date | null }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-2.5 py-1 text-xs text-navy-900"
      title={lastSync ? `Última sincronização de pedidos: ${formatDateTime(lastSync)}` : "Nenhuma sincronização concluída"}
    >
      <span className={cn("h-2 w-2 rounded-full", DOT[freshness], freshness === "atualizado" && "pulse-dot text-success/40")} />
      {LABEL[freshness]}
      {lastSync && <span className="text-muted">· {formatDateTime(lastSync)}</span>}
    </span>
  );
}
