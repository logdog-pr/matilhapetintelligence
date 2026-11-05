"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Results {
  customers: { id: string; name: string; tradeName: string | null; city: string | null }[];
  products: { id: string; name: string; sku: string; brand: string | null }[];
  sellers: { id: string; name: string; region: string | null }[];
}

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

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
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);

  const empty = results && !results.customers.length && !results.products.length && !results.sellers.length;

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar clientes, produtos, vendedores…"
        aria-label="Busca global"
        className="h-9 w-full rounded-lg border border-navy-100 bg-navy-50/60 pl-9 pr-14 text-sm text-navy-950 placeholder:text-navy-300 focus:border-navy-500 focus:bg-white focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-navy-100 bg-white px-1.5 text-[10px] text-muted">
        Ctrl K
      </kbd>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-96 overflow-y-auto rounded-xl border border-navy-100 bg-white p-2 shadow-lg shadow-navy-950/5">
          {loading && <p className="px-2 py-1.5 text-xs text-muted">Buscando…</p>}
          {error && <p className="px-2 py-1.5 text-xs text-danger">{error}</p>}
          {empty && <p className="px-2 py-1.5 text-xs text-muted">Nada encontrado.</p>}
          {results && (
            <>
              <Group title="Clientes" items={results.customers.map((c) => ({ id: c.id, main: c.tradeName ?? c.name, sub: [c.name, c.city].filter(Boolean).join(" · ") }))} />
              <Group title="Produtos" items={results.products.map((p) => ({ id: p.id, main: p.name, sub: [p.sku, p.brand].filter(Boolean).join(" · ") }))} />
              <Group title="Vendedores" items={results.sellers.map((s) => ({ id: s.id, main: s.name, sub: s.region ?? "" }))} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, items }: { title: string; items: { id: string; main: string; sub: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="py-1">
      <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{title}</p>
      {items.map((i) => (
        <div key={i.id} className={cn("rounded-md px-2 py-1.5 hover:bg-navy-50")}>
          <p className="truncate text-sm text-navy-950">{i.main}</p>
          {i.sub && <p className="truncate text-xs text-muted">{i.sub}</p>}
        </div>
      ))}
    </div>
  );
}
