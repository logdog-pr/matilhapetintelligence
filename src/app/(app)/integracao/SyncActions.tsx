"use client";

import { DatabaseZap, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

interface Result {
  resource: string;
  status: string;
  recordsRead: number;
  message?: string;
}

/**
 * Sincronização manual (ADMIN). A importação histórica é feita em lotes de ~45 s
 * (limite das funções serverless); o botão continua chamando até concluir.
 */
export function SyncActions({ disabled, neverImported }: { disabled: boolean; neverImported: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "full" | "incremental">(null);
  const [log, setLog] = useState<string | null>(null);

  async function run(mode: "full" | "incremental") {
    if (mode === "full" && !confirm("Iniciar/retomar a importação histórica completa? Ela consome requisições do limite diário (20.000).")) return;
    setBusy(mode);
    setLog(null);
    try {
      for (let round = 1; round <= 40; round++) {
        const res = await fetch("/api/integrations/pedidook/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha na sincronização");
        const results = data.results as Result[];
        const read = results.reduce((s, r) => s + r.recordsRead, 0);
        const failed = results.find((r) => r.status === "error");
        setLog(`Lote ${round}: ${read} registros lidos.${failed ? ` Erro em ${failed.resource}: ${failed.message}` : ""}`);
        router.refresh();
        if (data.done || failed || mode === "incremental") break;
        if (results.some((r) => r.status === "partial" && r.message?.includes("requisições"))) {
          setLog("Limite diário de requisições atingido. A importação continuará automaticamente amanhã.");
          break;
        }
      }
    } catch (e) {
      setLog((e as Error).message);
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button variant="secondary" disabled={disabled || !!busy || neverImported} onClick={() => run("incremental")} title={neverImported ? "Faça a importação histórica primeiro" : undefined}>
          <RefreshCw className={`h-4 w-4 ${busy === "incremental" ? "animate-spin" : ""}`} /> Sincronizar agora
        </Button>
        <Button disabled={disabled || !!busy} onClick={() => run("full")}>
          <DatabaseZap className="h-4 w-4" /> {busy === "full" ? "Importando…" : "Importação histórica"}
        </Button>
      </div>
      {disabled && <p className="text-xs text-muted">Configure PEDIDOOK_TOKEN_PARCEIRO e PEDIDOOK_TOKEN para habilitar.</p>}
      {log && <p className="max-w-md text-right text-xs text-navy-700">{log}</p>}
    </div>
  );
}
