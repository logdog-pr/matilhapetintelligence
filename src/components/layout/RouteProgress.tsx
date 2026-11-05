"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barra de progresso fina no topo durante a troca de página.
 * Liga ao clicar num link interno; desliga quando a URL muda.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
    };
    // Só formulários GET que realmente navegam (com action própria e sem preventDefault)
    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const f = e.target as HTMLFormElement;
      if (!f.getAttribute("action") || (f.method || "get").toLowerCase() !== "get") return;
      setActive(true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit); // fase de bolha: respeita preventDefault
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-navy-100" role="progressbar" aria-label="Carregando página">
      <div className="route-progress h-full w-1/2 rounded-full bg-gradient-to-r from-navy-500 to-navy-900" />
    </div>
  );
}
