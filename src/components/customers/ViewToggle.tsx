import { List, MapPinned } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Alterna entre a lista e o mapa de clientes mantendo os filtros. */
export function ViewToggle({ active, query }: { active: "lista" | "mapa"; query: string }) {
  return (
    <div className="flex rounded-lg border border-navy-100 bg-white p-1">
      <Link href={`/clientes${query ? `?${query}` : ""}`} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all", active === "lista" ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50")}>
        <List className="h-3.5 w-3.5" /> Lista
      </Link>
      <Link href={`/clientes/mapa${query ? `?${query}` : ""}`} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all", active === "mapa" ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50")}>
        <MapPinned className="h-3.5 w-3.5" /> Mapa
      </Link>
    </div>
  );
}
