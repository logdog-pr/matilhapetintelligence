import fs from "node:fs";
import path from "node:path";

export function fixture(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures", `${name}.json`), "utf8"));
}

type Handler = (url: URL) => { status?: number; body: unknown } | undefined;

/**
 * Servidor falso do PedidoOK (fetch) para testes. Registra cada URL chamada
 * e valida os headers de autenticação.
 */
export function fakeFetch(handler: Handler) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    const headers = new Headers(init?.headers);
    if (headers.get("token_parceiro") !== "tp" || headers.get("token_pedidook") !== "tk") {
      return new Response(JSON.stringify({ erros: [{ codigo: 4, mensagem: "token_parceiro inexistente" }] }), { status: 401 });
    }
    const r = handler(url);
    if (!r) return new Response(JSON.stringify({ erros: [{ codigo: 12, mensagem: "Registro não encontrado" }] }), { status: 404 });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { impl, calls };
}

/** Divide a lista de um fixture em páginas encadeadas por href_proxima_pagina. */
export function paginate(listKey: string, records: unknown[], perPage: number, basePath: string) {
  return (url: URL) => {
    const page = Number(url.searchParams.get("pagina") ?? "1");
    const slice = records.slice((page - 1) * perPage, page * perPage);
    const hasNext = page * perPage < records.length;
    const next = new URL(url.toString());
    next.searchParams.set("pagina", String(page + 1));
    return {
      body: {
        [listKey]: slice,
        href_proxima_pagina: hasNext ? next.toString() : null,
      },
      path: basePath,
    };
  };
}
