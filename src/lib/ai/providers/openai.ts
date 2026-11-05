/**
 * OpenAIProvider — Chat Completions com function calling, mesmo registro de
 * ferramentas e mesmo prompt de sistema do ClaudeProvider.
 * Modelo configurável em app_settings "ai.models".openai.
 */
import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { toolJsonSchema } from "../tools";
import type { AIProvider, ProviderRunInput, ProviderRunOutput, ToolCallRecord } from "./types";

let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI({ apiKey: env.openaiApiKey() }));

export const openaiProvider: AIProvider = {
  id: "openai",
  label: "OpenAI",
  isConfigured: () => !!env.openaiApiKey(),

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    const openai = getClient();
    const tools: OpenAI.Chat.ChatCompletionTool[] = input.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: toolJsonSchema(t) },
    }));
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: input.system },
      ...input.turns.map((t) => ({ role: t.role, content: t.content })),
    ];
    const toolCalls: ToolCallRecord[] = [];
    const usage = { inputTokens: 0, outputTokens: 0 };
    let model = input.model;

    for (let step = 0; step < input.maxSteps; step++) {
      const completion = await openai.chat.completions.create({ model: input.model, messages, tools });
      usage.inputTokens += completion.usage?.prompt_tokens ?? 0;
      usage.outputTokens += completion.usage?.completion_tokens ?? 0;
      model = completion.model;
      const choice = completion.choices[0];
      const msg = choice.message;
      const calls = (msg.tool_calls ?? []).filter((c): c is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => c.type === "function");

      if (msg.refusal) return { text: msg.refusal, toolCalls, model, usage, incomplete: "recusa" };
      if (calls.length === 0) {
        return { text: (msg.content ?? "").trim(), toolCalls, model, usage, incomplete: choice.finish_reason === "length" ? "limite_tokens" : undefined };
      }

      messages.push(msg);
      const results = await Promise.all(
        calls.map(async (c) => {
          let args: unknown = {};
          try {
            args = JSON.parse(c.function.arguments || "{}");
          } catch {
            args = null;
          }
          const r = args === null ? { ok: false, result: { erro: "Argumentos em JSON inválido." } } : await input.execute(c.function.name, args);
          toolCalls.push({ name: c.function.name, input: args, ok: r.ok });
          return { role: "tool" as const, tool_call_id: c.id, content: JSON.stringify(r.result) };
        }),
      );
      messages.push(...results);
    }
    return { text: "", toolCalls, model, usage, incomplete: "limite_passos" };
  },
};
