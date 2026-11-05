/**
 * Camada de abstração AIProvider (spec §15). Cada provedor só traduz o formato
 * de mensagens/ferramentas da sua API; regras de negócio, permissões e consultas
 * ficam em src/lib/ai/tools.ts e são as mesmas para todos.
 */
import type { AITool } from "../tools";

export type ProviderId = "claude" | "openai";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
  ok: boolean;
}

export interface ProviderRunInput {
  model: string;
  system: string;
  /** Histórico (só texto) + a pergunta atual como último turno "user". */
  turns: ChatTurn[];
  tools: AITool[];
  execute: (name: string, input: unknown) => Promise<{ ok: boolean; result: unknown }>;
  /** Limite de idas e voltas com ferramentas por pergunta. */
  maxSteps: number;
}

export interface ProviderRunOutput {
  text: string;
  toolCalls: ToolCallRecord[];
  /** Modelo que efetivamente respondeu (pode ser o de fallback). */
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  /** Resposta incompleta (recusa, limite de passos, limite de tokens). */
  incomplete?: string;
}

export interface AIProvider {
  id: ProviderId;
  label: string;
  isConfigured(): boolean;
  run(input: ProviderRunInput): Promise<ProviderRunOutput>;
}
