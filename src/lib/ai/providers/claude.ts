/**
 * ClaudeProvider — Anthropic Messages API com loop manual de ferramentas
 * (manual para compartilhar o mesmo registro de ferramentas com o OpenAIProvider).
 *
 * - Modelo padrão: claude-opus-5-5 (configurável em app_settings "ai.models").
 * - Pensamento adaptativo é sempre ligado nesse modelo; profundidade via effort.
 * - Fallback no servidor (`fallbacks: "default"`): se o modelo recusar por política,
 *   a própria API reexecuta em outro modelo dentro da mesma chamada.
 * - O histórico de cada pergunta é só acrescentado (nunca editado), como a API exige.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { toolJsonSchema } from "../tools";
import type { AIProvider, ProviderRunInput, ProviderRunOutput, ToolCallRecord } from "./types";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: env.anthropicApiKey() }));

export const claudeProvider: AIProvider = {
  id: "claude",
  label: "Claude (Anthropic)",
  isConfigured: () => !!env.anthropicApiKey(),

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    const anthropic = getClient();
    const tools: Anthropic.Beta.BetaTool[] = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: toolJsonSchema(t) as Anthropic.Beta.BetaTool.InputSchema,
    }));
    const messages: Anthropic.Beta.BetaMessageParam[] = input.turns.map((t) => ({ role: t.role, content: t.content }));
    const toolCalls: ToolCallRecord[] = [];
    const usage = { inputTokens: 0, outputTokens: 0 };
    let model = input.model;

    for (let step = 0; step < input.maxSteps; step++) {
      const response = await anthropic.beta.messages.create({
        model: input.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        // system + ferramentas são estáveis → cache do prefixo
        system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      });
      usage.inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0);
      usage.outputTokens += response.usage.output_tokens;
      model = response.model;

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      if (response.stop_reason === "refusal") {
        return { text: text || "Não posso responder a essa pergunta.", toolCalls, model, usage, incomplete: "recusa" };
      }
      if (response.stop_reason === "max_tokens") {
        return { text, toolCalls, model, usage, incomplete: "limite_tokens" };
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const uses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || uses.length === 0) {
        return { text, toolCalls, model, usage };
      }

      messages.push({ role: "assistant", content: response.content });
      // chamadas paralelas: executa todas e devolve todos os resultados numa única mensagem
      const results = await Promise.all(
        uses.map(async (u) => {
          const r = await input.execute(u.name, u.input);
          toolCalls.push({ name: u.name, input: u.input, ok: r.ok });
          return {
            type: "tool_result" as const,
            tool_use_id: u.id,
            content: JSON.stringify(r.result),
            is_error: !r.ok,
          } satisfies Anthropic.Beta.BetaToolResultBlockParam;
        }),
      );
      messages.push({ role: "user", content: results });
    }
    return { text: "", toolCalls, model, usage, incomplete: "limite_passos" };
  },
};
