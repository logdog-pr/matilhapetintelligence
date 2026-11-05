import "server-only";
import type { Database } from "@/lib/db/types";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { PedidookClient } from "./client";
import { budgetGuard } from "./sync";

/** Cria o cliente PedidoOK com as credenciais do servidor e o controle de orçamento diário. */
export async function createPedidookClient(db: Database): Promise<PedidookClient> {
  const tokenParceiro = env.pedidookTokenParceiro();
  const tokenPedidook = env.pedidookToken();
  if (!tokenParceiro || !tokenPedidook) {
    throw new Error("Credenciais do PedidoOK não configuradas (PEDIDOOK_TOKEN_PARCEIRO / PEDIDOOK_TOKEN).");
  }
  const limit = await getSetting(db, "sync.dailyRequestBudget");
  return new PedidookClient({ tokenParceiro, tokenPedidook, onBeforeRequest: budgetGuard(db, limit) });
}
