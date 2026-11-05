"use client";

import { Check, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function GenerateButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          const res = await fetch("/api/promotions/generate", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          setMsg(res.ok ? `${data.generated} sugestão(ões) gerada(s)${data.skippedRecentlyDecided ? ` · ${data.skippedRecentlyDecided} ignorada(s) por decisão recente` : ""}.` : (data.error ?? "Falha ao gerar."));
          router.refresh();
        }}
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> {busy ? "Calculando…" : "Atualizar sugestões"}
      </Button>
      {msg && <p className="text-xs text-navy-700">{msg}</p>}
    </div>
  );
}

export function DecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Motivo da rejeição (opcional):") : null;
    if (action === "reject" && note === null) return; // cancelou
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/promotions/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || null }),
    });
    setBusy(null);
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Falha.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => decide("approve")} disabled={!!busy}>
        <Check className="h-3.5 w-3.5" /> {busy === "approve" ? "…" : "Aprovar"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => decide("reject")} disabled={!!busy}>
        <X className="h-3.5 w-3.5" /> {busy === "reject" ? "…" : "Rejeitar"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
