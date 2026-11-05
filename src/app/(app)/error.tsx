"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { DogRunner } from "@/components/goal-progress/DogRunner";
import { Button } from "@/components/ui/primitives";

/** Falha ao carregar arquivos de uma versão anterior (após um novo deploy). */
function isStaleBuild(error: Error) {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${error.name} ${error.message}`);
}

/**
 * Tela de erro das páginas internas: no lugar do "Application error" em branco,
 * mostra o que aconteceu e permite tentar de novo. Se a falha for de uma versão
 * antiga do sistema ainda aberta no navegador, recarrega sozinha (uma vez).
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[matilha] erro na página:", error);
    if (isStaleBuild(error) && !sessionStorage.getItem("matilha:recarregou")) {
      sessionStorage.setItem("matilha:recarregou", "1");
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border border-navy-100 bg-white p-6 text-center">
      <div className="flex justify-center">
        <DogRunner pose="sit" mood="preocupado" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-navy-950">Ops, algo deu errado nesta tela</h1>
      <p className="mt-1 text-sm text-muted">
        {isStaleBuild(error)
          ? "O sistema foi atualizado enquanto a página estava aberta. Recarregue para usar a versão nova."
          : "Tente de novo. Se continuar, envie a mensagem abaixo para o suporte."}
      </p>
      <p className="mt-3 break-words rounded-md bg-navy-50 px-3 py-2 text-left font-mono text-xs text-navy-900">
        {error.message || "Erro sem mensagem"}
        {error.digest ? ` · código ${error.digest}` : ""}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={() => reset()}>
          <RefreshCw className="h-4 w-4" /> Tentar de novo
        </Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Recarregar a página
        </Button>
      </div>
    </div>
  );
}
