import { AlertTriangle, Moon, RefreshCcw, Repeat, Sparkles, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { CLASS_LABELS, type CustomerClass } from "@/lib/metrics/customers";

const MAP: Record<CustomerClass, { tone: "success" | "warning" | "danger" | "neutral" | "navy"; Icon: typeof UserCheck }> = {
  ativo: { tone: "success", Icon: UserCheck },
  recorrente: { tone: "navy", Icon: Repeat },
  novo: { tone: "neutral", Icon: Sparkles },
  recuperado: { tone: "success", Icon: RefreshCcw },
  em_risco: { tone: "warning", Icon: AlertTriangle },
  inativo: { tone: "danger", Icon: Moon },
};

/** Classe do cliente: ícone + texto (nunca só cor); motivo no title. */
export function ClassBadge({ cls, reasons }: { cls: CustomerClass; reasons?: string[] }) {
  const { tone, Icon } = MAP[cls];
  return (
    <span title={reasons?.join(" · ")}>
      <Badge tone={tone}>
        <Icon className="h-3 w-3" aria-hidden />
        {CLASS_LABELS[cls]}
      </Badge>
    </span>
  );
}
