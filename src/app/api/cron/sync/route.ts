import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { configStatus, env } from "@/lib/env";
import { createPedidookClient } from "@/lib/pedidook/service";
import { runDueResources } from "@/lib/pedidook/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = env.cronSecret();
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/**
 * GET /api/cron/sync — chamado pelo Vercel Cron a cada 5 minutos.
 * Executa somente os recursos cujo intervalo configurado venceu
 * (ou que têm execução pendente para retomar).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const cfg = configStatus();
  if (!cfg.database || !cfg.pedidook) return NextResponse.json({ error: "Integração não configurada." }, { status: 503 });
  try {
    const db = getDb();
    const client = await createPedidookClient(db);
    const results = await runDueResources(db, client, { mode: "incremental", trigger: "cron", deadline: Date.now() + 45_000 });
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[cron] falha:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Falha na sincronização." }, { status: 500 });
  }
}
