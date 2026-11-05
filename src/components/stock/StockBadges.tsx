import { AlertTriangle, CheckCircle2, CircleDashed, PackageSearch, ShoppingCart, Snail } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import type { Quality, StockStatus } from "@/lib/metrics/stock";
import { STATUS_LABELS } from "@/lib/queries/stock";

/** Situação do SKU: sempre ícone + texto (nunca só cor). */
export function StatusBadge({ status }: { status: StockStatus }) {
  const map: Record<StockStatus, { tone: "danger" | "warning" | "neutral" | "success" | "navy"; Icon: typeof AlertTriangle }> = {
    ruptura: { tone: "danger", Icon: AlertTriangle },
    comprar: { tone: "navy", Icon: ShoppingCart },
    excesso: { tone: "warning", Icon: PackageSearch },
    parado: { tone: "warning", Icon: Snail },
    ok: { tone: "success", Icon: CheckCircle2 },
    sem_giro: { tone: "neutral", Icon: CircleDashed },
  };
  const { tone, Icon } = map[status];
  return (
    <Badge tone={tone}>
      <Icon className="h-3 w-3" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function QualityBadge({ quality, reasons }: { quality: Quality; reasons?: string[] }) {
  const label = quality === "boa" ? "Boa" : quality === "limitada" ? "Limitada" : "Insuficiente";
  const tone = quality === "boa" ? "success" : quality === "limitada" ? "warning" : "neutral";
  return (
    <span title={reasons?.join(" · ")}>
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}
