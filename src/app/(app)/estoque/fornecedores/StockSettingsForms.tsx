"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";
import type { StockParams } from "@/lib/metrics/stock";

/** Campo de prazo de entrega por fornecedor (salva ao sair do campo ou Enter). */
export function LeadTimeInput({ supplierId, initial, disabled }: { supplierId: string; initial: number | null; disabled: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 365)) {
      setState("error");
      return;
    }
    if (parsed === initial) return;
    setState("saving");
    const res = await fetch(`/api/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadTimeDays: parsed }),
    });
    setState(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={365}
        value={value}
        disabled={disabled}
        placeholder="padrão"
        aria-label="Prazo de entrega em dias"
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="h-8 w-24 text-right"
      />
      <span className="w-14 text-xs text-muted">
        {state === "saving" && "salvando…"}
        {state === "saved" && (
          <span className="animate-pop inline-flex items-center gap-1 text-success">
            <Check className="h-3 w-3" /> salvo
          </span>
        )}
        {state === "error" && <span className="text-danger">0 a 365</span>}
      </span>
    </span>
  );
}

const FIELDS: { key: keyof StockParams; label: string; hint: string }[] = [
  { key: "windowDays", label: "Janela de demanda (dias)", hint: "período usado na demanda média" },
  { key: "safetyDays", label: "Dias de segurança", hint: "estoque de segurança = demanda × dias" },
  { key: "reviewDays", label: "Intervalo de revisão (dias)", hint: "a cada quantos dias se faz compra" },
  { key: "defaultLeadTimeDays", label: "Prazo padrão (dias)", hint: "quando o fornecedor não tem prazo" },
  { key: "minHistoryDays", label: "Histórico mínimo (dias)", hint: "abaixo disso, não há sugestão" },
  { key: "excessCoverageDays", label: "Excesso acima de (dias)", hint: "cobertura considerada excesso" },
  { key: "idleDays", label: "Parado após (dias)", hint: "sem venda há mais que isso" },
];

export function StockParamsForm({ initial, disabled }: { initial: StockParams; disabled: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]));
    const res = await fetch("/api/settings/stock", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Parâmetros salvos. As sugestões já usam os novos valores." } : { ok: false, text: data.issues?.[0] ? `${data.issues[0].path}: ${data.issues[0].message}` : (data.error ?? "Falha ao salvar.") });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Label htmlFor={f.key}>{f.label}</Label>
          <Input id={f.key} type="number" min={0} value={form[f.key]} disabled={disabled} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
          <p className="mt-1 text-[11px] text-muted">{f.hint}</p>
        </div>
      ))}
      <div className="flex items-end">
        {!disabled && (
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar parâmetros"}
          </Button>
        )}
      </div>
      {msg && <p className={`text-sm sm:col-span-2 lg:col-span-4 ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
