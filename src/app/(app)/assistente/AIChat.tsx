"use client";

import { Bot, Database, Loader2, MessageSquarePlus, Send, Settings2, Trash2, User } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { EXAMPLE_QUESTIONS, TOOL_LABELS } from "@/lib/ai/labels";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Meta {
  provider?: string;
  model?: string;
  tools?: { name: string; ok: boolean }[];
  incomplete?: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Meta | null;
  error?: boolean;
}

interface ProvidersInfo {
  current: "claude" | "openai";
  providers: { id: "claude" | "openai"; label: string; model: string; configured: boolean }[];
}

/** Formatação leve: **negrito**, listas com "-" e parágrafos. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(b.replace(/^#+\s*/gm, ""))}
          </p>
        );
      })}
    </div>
  );
}

function Sources({ meta }: { meta?: Meta | null }) {
  if (!meta) return null;
  const tools = [...new Set((meta.tools ?? []).filter((t) => t.ok).map((t) => TOOL_LABELS[t.name] ?? t.name))];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-navy-50 pt-2 text-[11px] text-muted">
      <Database className="h-3 w-3" />
      {tools.length ? tools.map((t) => <Badge key={t}>{t}</Badge>) : <span>Sem consulta a dados</span>}
      {meta.incomplete && <Badge tone="warning">resposta incompleta</Badge>}
      {meta.model && <span className="ml-auto">{meta.model}</span>}
    </div>
  );
}

export function AIChat({
  initialConversations,
  providers: initialProviders,
  configured,
  canManage,
  isManager,
  sellerWithoutLink,
}: {
  initialConversations: Conversation[];
  providers: ProvidersInfo;
  configured: boolean;
  canManage: boolean;
  isManager: boolean;
  sellerWithoutLink: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [providers, setProviders] = useState(initialProviders);
  const [showSettings, setShowSettings] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Chaves obrigatórias: em navegadores novos scrollIntoView retorna uma Promise, e um
  // useEffect não pode retornar nada além de uma função (o React tentaria "chamar" a Promise).
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const currentConfigured = providers.providers.find((p) => p.id === providers.current)?.configured ?? configured;

  async function openConversation(id: string) {
    setActiveId(id);
    setLoadingConv(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(Array.isArray(data.messages) ? data.messages.map((m: Message) => ({ ...m, content: m.content ?? "" })) : []);
    } catch (e) {
      setMessages([{ id: "err", role: "assistant", content: (e as Error).message || "Falha ao abrir a conversa.", error: true }]);
    } finally {
      setLoadingConv(false);
    }
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  async function removeConversation(id: string) {
    if (!confirm("Excluir esta conversa?")) return;
    const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConversations((c) => c.filter((x) => x.id !== id));
      if (activeId === id) newConversation();
    }
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId ?? undefined, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(
          data?.error ?? (res.status === 504 ? "O assistente demorou demais para responder. Tente uma pergunta mais curta." : "Falha ao consultar o assistente."),
        );
      }
      const content = typeof data?.message?.content === "string" && data.message.content.trim() ? data.message.content : "Não obtive resposta do assistente. Tente novamente.";
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content, metadata: data?.message?.metadata ?? null }]);
      if (!activeId) {
        setActiveId(data.conversationId);
        setConversations((c) => [{ id: data.conversationId, title: message.slice(0, 80), updatedAt: new Date().toISOString() }, ...c]);
      } else {
        setConversations((c) => {
          const cur = c.find((x) => x.id === activeId);
          return cur ? [{ ...cur, updatedAt: new Date().toISOString() }, ...c.filter((x) => x.id !== activeId)] : c;
        });
      }
    } catch (e) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(form: FormData) {
    const body = {
      provider: form.get("provider"),
      models: { claude: form.get("model_claude"), openai: form.get("model_openai") },
    };
    const res = await fetch("/api/ai/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return alert(data.error ?? "Falha ao salvar.");
    setProviders(data);
    setShowSettings(false);
  }

  const examples = EXAMPLE_QUESTIONS.filter((q) => isManager || !q.managerOnly);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* histórico */}
      <Card className="flex max-h-[calc(100vh-200px)] flex-col p-3">
        <Button variant="secondary" className="w-full" onClick={newConversation}>
          <MessageSquarePlus className="h-4 w-4" /> Nova conversa
        </Button>
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 && <p className="px-2 py-4 text-xs text-muted">Suas conversas aparecem aqui.</p>}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-50",
                activeId === c.id && "bg-navy-50 font-medium",
              )}
            >
              <button className="flex-1 truncate text-left text-navy-950" onClick={() => openConversation(c.id)} title={c.title}>
                {c.title}
              </button>
              <button className="opacity-0 transition group-hover:opacity-100" onClick={() => removeConversation(c.id)} aria-label="Excluir conversa">
                <Trash2 className="h-3.5 w-3.5 text-muted hover:text-danger" />
              </button>
            </div>
          ))}
        </div>
        {canManage && (
          <button className="mt-2 flex items-center gap-1.5 px-2 text-xs text-muted hover:text-navy-900" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-3.5 w-3.5" /> Provedor: {providers.providers.find((p) => p.id === providers.current)?.label}
          </button>
        )}
      </Card>

      {/* conversa */}
      <Card className="flex h-[calc(100vh-200px)] min-h-[480px] flex-col">
        {showSettings && canManage && (
          <form action={saveSettings} className="grid gap-3 border-b border-navy-100 p-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="provider">Provedor</Label>
              <Select id="provider" name="provider" defaultValue={providers.current}>
                {providers.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.configured ? "" : " (sem chave)"}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="model_claude">Modelo Claude</Label>
              <Input id="model_claude" name="model_claude" defaultValue={providers.providers.find((p) => p.id === "claude")?.model} />
            </div>
            <div>
              <Label htmlFor="model_openai">Modelo OpenAI</Label>
              <Input id="model_openai" name="model_openai" defaultValue={providers.providers.find((p) => p.id === "openai")?.model} />
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" size="sm">
                Salvar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                Cancelar
              </Button>
              <p className="ml-auto self-center text-xs text-muted">As chaves ficam nas variáveis ANTHROPIC_API_KEY / OPENAI_API_KEY.</p>
            </div>
          </form>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!currentConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
              O assistente ainda não está configurado: falta a chave de API do provedor selecionado.
              {canManage ? " Adicione ANTHROPIC_API_KEY (ou OPENAI_API_KEY) no .env.local e na Vercel." : " Avise o administrador."}
            </div>
          )}
          {sellerWithoutLink && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
              Seu usuário não está vinculado a um vendedor do PedidoOK, então o assistente não consegue consultar seus dados. Avise o administrador.
            </div>
          )}

          {loadingConv && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />}

          {!loadingConv && messages.length === 0 && (
            <div className="mx-auto max-w-xl py-8 text-center">
              <Bot className="mx-auto h-10 w-10 text-navy-300" />
              <p className="mt-3 text-sm text-muted">Comece com uma pergunta. Alguns exemplos:</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {examples.map((q) => (
                  <button
                    key={q.text}
                    disabled={busy || !currentConfigured}
                    onClick={() => send(q.text)}
                    className="rounded-lg border border-navy-100 px-3 py-2 text-left text-sm text-navy-900 transition hover:bg-navy-50 disabled:opacity-50"
                  >
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-navy-100" : "bg-navy-900")}>
                {m.role === "user" ? <User className="h-4 w-4 text-navy-700" /> : <Bot className="h-4 w-4 text-white" />}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user" ? "bg-navy-900 text-white" : m.error ? "border border-red-200 bg-red-50 text-danger" : "border border-navy-100 bg-white text-navy-950",
                )}
              >
                {m.role === "assistant" && !m.error ? <RichText text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                {m.role === "assistant" && !m.error && <Sources meta={m.metadata} />}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 pl-10 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando os dados…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex gap-2 border-t border-navy-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre vendas, metas, clientes, produtos…"
            maxLength={2000}
            disabled={busy || !currentConfigured}
            className="flex-1"
          />
          <Button type="submit" disabled={busy || !input.trim() || !currentConfigured}>
            <Send className="h-4 w-4" /> Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}
