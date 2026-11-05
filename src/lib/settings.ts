/**
 * Regras configuráveis (tabela app_settings) com valores padrão.
 */
import { eq } from "drizzle-orm";
import { appSettings } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";

export const SETTING_DEFAULTS = {
  /** Intervalo mínimo entre sincronizações incrementais, em minutos (spec §5). */
  "sync.intervals": {
    pedidos: 5,
    cobrancas: 15,
    clientes: 30,
    produtos: 30,
    vendedores: 60,
    fornecedores: 60,
    condicoes_pagamento: 60,
    tabelas_preco: 60,
    clientes_vendedores: 30,
  } as Record<string, number>,
  /** Margem de segurança abaixo do limite oficial de 20.000 req/dia. */
  "sync.dailyRequestBudget": 18000,
  /** Sobreposição temporal do cursor incremental, em minutos. */
  "sync.overlapMinutes": 5,
  /** Clientes cujas associações com vendedores são lidas por execução (1 req/cliente). */
  "sync.customerSellersPerRun": 150,
  /** Releitura periódica das associações, em dias. */
  "sync.customerSellersRefreshDays": 7,
  /** Status de pedido que contam como faturamento. */
  "revenue.statuses": ["pedido"] as string[],
  /** Feriados (YYYY-MM-DD) desconsiderados no cálculo por dias úteis. */
  "goals.holidays": [] as string[],
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(db: Database, key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (!row) return SETTING_DEFAULTS[key];
  const def = SETTING_DEFAULTS[key];
  if (def && typeof def === "object" && !Array.isArray(def)) {
    return { ...(def as object), ...(row.value as object) } as (typeof SETTING_DEFAULTS)[K];
  }
  return row.value as (typeof SETTING_DEFAULTS)[K];
}

export async function setSetting<K extends SettingKey>(
  db: Database,
  key: K,
  value: (typeof SETTING_DEFAULTS)[K],
  userId: string | null,
) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: userId, updatedAt: new Date() } });
}
