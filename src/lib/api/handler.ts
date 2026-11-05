import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { assertCan, HttpError, type Permission } from "@/lib/auth/rbac";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { configStatus } from "@/lib/env";
import { rateLimit } from "./rate-limit";

export interface RouteContext<P> {
  req: NextRequest;
  user: SessionUser;
  params: P;
}

/**
 * Envelope padrão das rotas internas: autenticação, autorização (RBAC),
 * limite de requisições e tratamento de erros (Zod → 400, HttpError → status).
 */
export function apiRoute<P = Record<string, string>>(
  options: { permission: Permission; rateLimit?: { limit: number; windowMs: number } },
  handler: (ctx: RouteContext<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, segment: { params: Promise<P> }) => {
    try {
      const cfg = configStatus();
      if (!cfg.database || !cfg.auth) throw new HttpError(503, "Sistema ainda não configurado (banco/autenticação).");
      const user = await getCurrentUser();
      assertCan(user, options.permission);
      const rl = options.rateLimit ?? { limit: 120, windowMs: 60_000 };
      if (!rateLimit(`${user.id}:${req.nextUrl.pathname}`, rl.limit, rl.windowMs)) {
        throw new HttpError(429, "Muitas requisições. Tente novamente em instantes.");
      }
      const params = (await segment?.params) ?? ({} as P);
      const result = await handler({ req, user, params });
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Parâmetros inválidos.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  console.error("[api] erro não tratado:", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Erro interno." }, { status: 500 });
}
