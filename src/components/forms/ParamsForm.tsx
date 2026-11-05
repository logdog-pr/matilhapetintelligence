"use client";

import { toast } from "@/components/ui/Toaster";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";

export interface ParamField {
  key: string;
  label: string;
  hint?: string;
  step?: number;
}

/** Formulário genérico de parâmetros numéricos (PATCH no endpoint informado). */
export function ParamsForm({
  fields,
  initial,
  endpoint,
  disabled,
  successText = "Parâmetros salvos.",
}: {
  fields: ParamField[];
  initial: Record<string, number>;
  endpoint: string;
  disabled: boolean;
  successText?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const body = Object.fromEntries(fields.map((f) => [f.key, Number(String(form[f.key]).replace(",", "."))]));
    const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(
      res.ok
        ? { ok: true, text: successText }
        : { ok: false, text: data.issues?.[0] ? `${fields.find((f) => f.key === data.issues[0].path)?.label ?? data.issues[0].path}: ${data.issues[0].message}` : (data.error ?? "Falha ao salvar.") },
    );
    if (res.ok) {
      toast(successText);
      router.refresh();
    } else toast("Não foi possível salvar os parâmetros.", "error");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map((f) => (
        <div key={f.key}>
          <Label htmlFor={f.key}>{f.label}</Label>
          <Input
            id={f.key}
            type="number"
            step={f.step ?? 1}
            min={0}
            value={form[f.key] ?? ""}
            disabled={disabled}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
          />
          {f.hint && <p className="mt-1 text-[11px] text-muted">{f.hint}</p>}
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
