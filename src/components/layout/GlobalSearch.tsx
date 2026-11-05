"use client";

import { ArrowRight, Boxes, CornerDownLeft, FileSearch, Search, Store, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Role } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";

interface Results {
  customers: { id: string; name: string; tradeName: string | null; city: string | null }[];
  products: { id: string; name: string; sku: string; brand: string | null }[];
  sellers: { id: string; name: string; region: string | null }[];
  canOpenProducts: boolean;
}

interface Item {
  key: string;
  group: string;
  main: string;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PAGES: { label: string; href: string; keywords: string; roles?: Role[] }[] = [
  { label: "Dashboard", href: "/", keywords: "inicio painel faturamento" },
  { label: "Metas", href: "/metas", keywords: "objetivo ranking" },
  { label: "Vendedores", href: "/vendedores", keywords: "ranking desempenho", roles: ["ADMIN", "GESTOR"] },
  { label: "Pedidos", href: "/pedidos", keywords: "vendas" },
  { label: "Clientes", href: "/clientes", keywords: "carteira" },
  { label: "Oportunidades (clientes em risco)", href: "/clientes?classe=oportunidades", keywords: "inativos risco contato ligar" },
  { label: "Mapa de clientes", href: "/clientes/mapa", keywords: "calor regiao cidade" },
  { label: "Promoções", href: "/promocoes", keywords: "desconto sugestoes", roles: ["ADMIN", "GESTOR"] },
  { label: "Estoque", href: "/estoque", keywords: "comprar ruptura reposicao", roles: ["ADMIN", "GESTOR"] },
  { label: "Pet Intelligence AI", href: "/assistente", keywords: "ia assistente perguntar" },
  { label: "Integração PedidoOK", href: "/integracao", keywords: "sincronizar importacao", roles: ["ADMIN"] },
  { label: "Usuários", href: "/usuarios", keywords: "acesso senha", roles: ["ADMIN"] },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Busca global (Ctrl/⌘ K): páginas + clientes, produtos e vendedores, com navegação por teclado. */
export function GlobalSearch({ role }: { role?: Role }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha na busca");
        setResults(data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const pages: Item[] = PAGES.filter((p) => (!p.roles || !role || p.roles.includes(role)) && norm(`${p.label} ${p.keywords}`).includes(t))
      .slice(0, 4)
      .map((p) => ({ key: `page:${p.href}`, group: "Páginas", main: p.label, href: p.href, icon: ArrowRight }));
    if (!results) return pages;
    return [
      ...pages,
      ...results.customers.map((c) => ({
        key: `c:${c.id}`,
        group: "Clientes",
        main: c.tradeName ?? c.name,
        sub: [c.tradeName ? c.name : null, c.city].filter(Boolean).join(" · "),
        href: `/clientes/${c.id}`,
        icon: Store,
      })),
      ...results.products.map((p) => ({
        key: `p:${p.id}`,
        group: "Produtos",
        main: p.name,
        sub: [p.sku, p.brand].filter(Boolean).join(" · "),
        href: results.canOpenProducts ? `/estoque/${p.id}` : undefined,
        icon: Boxes,
      })),
      ...results.sellers.map((s) => ({ key: `s:${s.id}`, group: "Vendedores", main: s.name, sub: s.region ?? "", href: `/vendedores/${s.id}`, icon: UserRound })),
    ];
  }, [q, results, role]);

  useEffect(() => setActive(0), [items.length]);

  function go(item: Item | undefined) {
    if (!item?.href) return;
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(item.href);
  }

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  }

  const showPanel = open && q.trim().length >= 1;
  let lastGroup = "";

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar clientes, produtos, páginas…"
        aria-label="Busca global"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="busca-global-resultados"
        aria-activedescendant={items[active] ? `busca-${items[active].key}` : undefined}
        className="h-9 w-full rounded-lg border border-navy-100 bg-navy-50/60 pl-9 pr-14 text-sm text-navy-950 transition-all placeholder:text-navy-300 focus:border-navy-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(30,58,107,0.08)] focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-navy-100 bg-white px-1.5 text-[10px] text-muted sm:block">Ctrl K</kbd>

      {showPanel && (
        <div className="animate-pop absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-xl shadow-navy-950/10">
          <ul id="busca-global-resultados" role="listbox" className="max-h-96 overflow-y-auto p-2">
            {items.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              const Icon = it.icon;
              return (
                <li key={it.key} role="presentation">
                  {header && <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted first:pt-0">{header}</p>}
                  <div
                    id={`busca-${it.key}`}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={!it.href}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(it)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                      it.href ? "cursor-pointer" : "cursor-default opacity-70",
                      i === active ? "bg-navy-50" : "hover:bg-navy-50/60",
                    )}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", i === active ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700")}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-navy-950">{it.main}</span>
                      {it.sub && <span className="block truncate text-xs text-muted">{it.sub}</span>}
                    </span>
                    {i === active && it.href && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-navy-300" />}
                  </div>
                </li>
              );
            })}
          </ul>
          {loading && <p className="px-4 pb-3 text-xs text-muted">Buscando…</p>}
          {error && <p className="px-4 pb-3 text-xs text-danger">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <FileSearch className="h-5 w-5 text-navy-300" />
              <p className="text-sm text-navy-950">{q.trim().length < 2 ? "Continue digitando…" : "Nada encontrado."}</p>
            </div>
          )}
          <div className="flex items-center gap-3 border-t border-navy-100 bg-navy-50/50 px-3 py-1.5 text-[10px] text-muted">
            <span>
              <kbd className="rounded border border-navy-100 bg-white px-1">↑</kbd> <kbd className="rounded border border-navy-100 bg-white px-1">↓</kbd> navegar
            </span>
            <span>
              <kbd className="rounded border border-navy-100 bg-white px-1">Enter</kbd> abrir
            </span>
            <span>
              <kbd className="rounded border border-navy-100 bg-white px-1">Esc</kbd> fechar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
