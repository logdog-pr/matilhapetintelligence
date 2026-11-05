/**
 * Pet Intelligence AI — orquestra conversa, provedor e histórico.
 * Regras (spec §15): não inventar números, citar período e fonte, informar limitações,
 * nunca SQL arbitrário, respeitar o perfil do usuário.
 */
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { HttpError } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { aiConversations, aiMessages } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { formatDate, todayInSaoPaulo } from "@/lib/format";
import { getSetting, setSetting } from "@/lib/settings";
import { claudeProvider } from "./providers/claude";
import { openaiProvider } from "./providers/openai";
import type { AIProvider, ChatTurn, ProviderId } from "./providers/types";
import { executeTool, toolsFor } from "./tools";

export const PROVIDERS: Record<ProviderId, AIProvider> = { claude: claudeProvider, openai: openaiProvider };

/** Mensagens anteriores enviadas ao modelo (o resto fica só no histórico salvo). */
const HISTORY_LIMIT = 20;
const MAX_STEPS = 8;

const ROLE_LABEL = { ADMIN: "administrador", GESTOR: "gestor comercial", VENDEDOR: "vendedor" } as const;

export function buildSystemPrompt(user: SessionUser, today: string) {
  const scope =
    user.role === "VENDEDOR"
      ? "Este usuário é VENDEDOR: as ferramentas já devolvem só os dados dele. Não comente nem estime números de outros vendedores, da empresa toda, margens ou custos — se perguntarem, explique que o perfil dele não tem acesso."
      : "Este usuário pode ver os números da empresa e de todos os vendedores.";
  return `Você é o Pet Intelligence AI, assistente de inteligência comercial da Matilha (distribuidora do setor pet).
Responda sempre em português do Brasil, de forma direta e útil para quem vende e gerencia.

Usuário: ${user.name} (${ROLE_LABEL[user.role]}). Hoje é ${formatDate(today)} (${today}), fuso de São Paulo.
${scope}

Regras obrigatórias:
- Todo número que você citar deve vir de uma ferramenta chamada nesta conversa. Nunca invente, estime de cabeça ou arredonde de forma enganosa. Se precisar de um número, chame a ferramenta.
- Em respostas com números, informe o período analisado e, numa linha final curta "Fonte: ...", de onde vieram os dados (use o campo "fonte" das ferramentas).
- Se as ferramentas não trouxerem dados suficientes, diga claramente qual é a limitação em vez de supor.
- Recomendações (o que fazer, quem contatar, como aumentar o ticket) devem se apoiar nos dados consultados; deixe claro o que é sugestão sua.
- Valores em reais no formato R$ 1.234,56; datas no formato DD/MM/AAAA.
- Use texto simples, frases curtas e listas com "-" quando ajudar. Não use tabelas.

Limitações conhecidas dos dados (avise quando forem relevantes para a pergunta):
- Recebimentos, cobranças e inadimplência ainda não estão disponíveis no sistema (controlados manualmente, fora do PedidoOK). Não responda sobre o que foi pago ou está em atraso.
- Desde 2025 os produtos estão sem custo cadastrado no PedidoOK, então margem e lucro só cobrem parte do faturamento (veja "cobertura_custo_pct").
- O estoque não é controlado no PedidoOK; sugestões de compra são apenas indicativas.
- O histórico de pedidos começa em dezembro de 2023.`;
}

export const chatInputSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1, "Digite uma pergunta.").max(2000, "Pergunta muito longa (máx. 2.000 caracteres)."),
});

export async function getAIConfig(db: Database) {
  const [provider, models] = await Promise.all([getSetting(db, "ai.provider"), getSetting(db, "ai.models")]);
  return { provider, models };
}

export async function listProviders(db: Database) {
  const cfg = await getAIConfig(db);
  return {
    current: cfg.provider,
    providers: (Object.values(PROVIDERS) as AIProvider[]).map((p) => ({
      id: p.id,
      label: p.label,
      model: cfg.models[p.id],
      configured: p.isConfigured(),
    })),
  };
}

export const aiSettingsSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  models: z
    .object({ claude: z.string().trim().min(3).max(80), openai: z.string().trim().min(2).max(80) })
    .partial()
    .optional(),
});

export async function updateAISettings(db: Database, user: SessionUser, input: z.infer<typeof aiSettingsSchema>) {
  const current = await getAIConfig(db);
  await setSetting(db, "ai.provider", input.provider, user.id);
  if (input.models) await setSetting(db, "ai.models", { ...current.models, ...input.models }, user.id);
  return listProviders(db);
}

async function ownConversation(db: Database, user: SessionUser, id: string) {
  const [conv] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id)))
    .limit(1);
  if (!conv) throw new HttpError(404, "Conversa não encontrada.");
  return conv;
}

export async function listConversations(db: Database, user: SessionUser) {
  return db
    .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
    .from(aiConversations)
    .where(eq(aiConversations.userId, user.id))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(50);
}

export async function getConversation(db: Database, user: SessionUser, id: string) {
  const conv = await ownConversation(db, user, id);
  const messages = await db
    .select({ id: aiMessages.id, role: aiMessages.role, content: aiMessages.content, metadata: aiMessages.metadata, createdAt: aiMessages.createdAt })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt));
  return { id: conv.id, title: conv.title, messages };
}

export async function deleteConversation(db: Database, user: SessionUser, id: string) {
  await ownConversation(db, user, id);
  await db.delete(aiConversations).where(eq(aiConversations.id, id));
  return { ok: true };
}

export async function chat(db: Database, user: SessionUser, input: z.infer<typeof chatInputSchema>, now = new Date()) {
  const cfg = await getAIConfig(db);
  const provider = PROVIDERS[cfg.provider];
  if (!provider.isConfigured()) {
    const key = cfg.provider === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    throw new HttpError(503, `O assistente ainda não está configurado: falta a variável ${key}.`);
  }
  const model = cfg.models[cfg.provider];

  let conversationId = input.conversationId;
  let history: ChatTurn[] = [];
  if (conversationId) {
    await ownConversation(db, user, conversationId);
    const rows = await db
      .select({ role: aiMessages.role, content: aiMessages.content })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(desc(aiMessages.createdAt))
      .limit(HISTORY_LIMIT);
    history = rows.reverse().filter((r): r is ChatTurn => (r.role === "user" || r.role === "assistant") && r.content.trim() !== "");
    // o histórico enviado precisa começar por "user"
    while (history.length && history[0].role !== "user") history.shift();
  }

  const today = todayInSaoPaulo(now);
  const out = await provider.run({
    model,
    system: buildSystemPrompt(user, today),
    turns: [...history, { role: "user", content: input.message }],
    tools: toolsFor(user),
    execute: async (name, toolInput) => executeTool({ db, user, now }, name, toolInput),
    maxSteps: MAX_STEPS,
  });

  const text =
    out.text ||
    (out.incomplete === "limite_passos"
      ? "Não consegui concluir a análise com as consultas disponíveis. Tente uma pergunta mais específica."
      : "Não obtive resposta do assistente. Tente novamente.");

  const metadata = {
    provider: provider.id,
    model: out.model,
    tools: out.toolCalls,
    usage: out.usage,
    incomplete: out.incomplete ?? null,
  };

  await db.transaction(async (tx) => {
    if (!conversationId) {
      const [conv] = await tx
        .insert(aiConversations)
        .values({ userId: user.id, provider: provider.id, model: out.model, title: input.message.slice(0, 80) })
        .returning({ id: aiConversations.id });
      conversationId = conv.id;
    } else {
      await tx.update(aiConversations).set({ provider: provider.id, model: out.model, updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
    }
    // timestamps explícitos: garante a ordem user → assistant (now() do Postgres é igual na transação)
    const t = Date.now();
    await tx.insert(aiMessages).values({ conversationId: conversationId!, role: "user", content: input.message, createdAt: new Date(t) });
    await tx.insert(aiMessages).values({ conversationId: conversationId!, role: "assistant", content: text, metadata, createdAt: new Date(t + 1) });
  });

  return { conversationId: conversationId!, message: { role: "assistant" as const, content: text, metadata } };
}
