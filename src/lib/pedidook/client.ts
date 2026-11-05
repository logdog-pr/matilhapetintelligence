/**
 * PedidoOK Integration Service — cliente HTTP somente leitura (GET).
 *
 * - Autenticação por headers token_parceiro / token_pedidook.
 * - Paginação via `href_proxima_pagina` (null = fim). Só seguimos URLs do
 *   host oficial, para nunca enviar os tokens a outro domínio.
 * - Retry com backoff exponencial para falhas de rede, 429 e 5xx.
 * - Cada requisição é contabilizada (limite de 20.000/dia por token_pedidook).
 */
import { erroSchema } from "./schemas";

export const PEDIDOOK_BASE_URL = "https://api.pedidook.com.br/v1/";
const ALLOWED_HOST = "api.pedidook.com.br";

export class PedidookApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null,
    readonly codes: number[] = [],
    readonly retryable = false,
  ) {
    super(message);
    this.name = "PedidookApiError";
  }
  /** Erro 42 — limite diário de requisições excedido. */
  get isRateLimited() {
    return this.codes.includes(42) || this.httpStatus === 429;
  }
}

export class RequestBudgetExceededError extends Error {
  constructor(used: number, limit: number) {
    super(`Orçamento diário de requisições atingido (${used}/${limit}).`);
    this.name = "RequestBudgetExceededError";
  }
}

export interface PedidookClientOptions {
  tokenParceiro: string;
  tokenPedidook: string;
  fetchImpl?: typeof fetch;
  /** Chamado antes de cada requisição; deve lançar RequestBudgetExceededError se não houver orçamento. */
  onBeforeRequest?: () => Promise<void>;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface PageResult<T = unknown> {
  records: T[];
  nextPageUrl: string | null;
  url: string;
}

export class PedidookClient {
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  requestsMade = 0;

  constructor(private readonly opts: PedidookClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 1000;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Monta a URL de listagem de um recurso (ex.: "pedidos", "clientes/123/vendedores"). */
  static listUrl(path: string, params: Record<string, string | number | boolean | undefined> = {}): string {
    const url = new URL(path.replace(/^\/+/, "").replace(/\/?$/, "/"), PEDIDOOK_BASE_URL);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    return url.toString();
  }

  static assertAllowedUrl(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
      throw new PedidookApiError(`URL de paginação fora do domínio oficial: ${parsed.hostname}`, null);
    }
  }

  /** Busca uma página. `listKey` é a chave do array no JSON (ex.: "pedidos"). */
  async getPage<T = unknown>(url: string, listKey: string): Promise<PageResult<T>> {
    PedidookClient.assertAllowedUrl(url);
    const json = await this.requestJson(url);
    const records = (json as Record<string, unknown>)[listKey];
    if (!Array.isArray(records)) {
      throw new PedidookApiError(`Resposta sem a lista "${listKey}" em ${redact(url)}`, 200);
    }
    const next = (json as Record<string, unknown>).href_proxima_pagina;
    return { records: records as T[], nextPageUrl: typeof next === "string" && next ? next : null, url };
  }

  private async requestJson(url: string): Promise<unknown> {
    let attempt = 0;
    for (;;) {
      await this.opts.onBeforeRequest?.();
      this.requestsMade++;
      try {
        const res = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            token_parceiro: this.opts.tokenParceiro,
            token_pedidook: this.opts.tokenPedidook,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });
        const text = await res.text();
        const body = text ? safeJson(text) : null;
        if (res.ok) return body;

        const parsed = erroSchema.safeParse(body);
        const codes = parsed.success ? parsed.data.erros.map((e) => e.codigo) : [];
        const msg = parsed.success
          ? parsed.data.erros.map((e) => `${e.codigo}-${e.mensagem}`).join("; ")
          : `HTTP ${res.status}`;
        throw new PedidookApiError(
          `PedidoOK: ${msg}`,
          res.status,
          codes,
          res.status >= 500 || codes.includes(998) || codes.includes(999),
        );
      } catch (e) {
        // Erros da API: só repete os transitórios (nunca o limite diário, código 42).
        // Demais erros (rede/timeout): repete.
        const retryable = e instanceof PedidookApiError ? e.retryable && !e.isRateLimited : true;
        if (!retryable || attempt >= this.maxRetries) throw e;
        await this.sleep(this.baseDelayMs * 2 ** attempt);
        attempt++;
      }
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Remove parâmetros sensíveis de URLs antes de registrar em log. */
export function redact(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ["token_parceiro", "token_pedidook"]) if (u.searchParams.has(k)) u.searchParams.set(k, "***");
    return u.toString();
  } catch {
    return "[url inválida]";
  }
}

/** Formata um timestamp da fonte (sem fuso) no formato aceito por `alterado_apos`. */
export function toAlteradoApos(sourceTimestamp: string, overlapMinutes = 0): string {
  const d = new Date(`${sourceTimestamp.replace(" ", "T").slice(0, 19)}Z`); // aritmética pura, sem conversão de fuso
  d.setUTCMinutes(d.getUTCMinutes() - overlapMinutes);
  return d.toISOString().slice(0, 19);
}

/** Normaliza "2019-04-09T10:41:31.00007" → "2019-04-09T10:41:31.000070" (comparável como string). */
export function normalizeSourceTimestamp(ts: string): string {
  const [main, frac = ""] = ts.replace(" ", "T").split(".");
  return `${main.slice(0, 19)}.${frac.replace(/\D/g, "").padEnd(6, "0").slice(0, 6)}`;
}
