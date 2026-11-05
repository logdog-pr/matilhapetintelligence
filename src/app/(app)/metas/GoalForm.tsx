"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui/primitives";

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

/** Converte "12.500,50" ou "12500.5" em número. */
function parseBRL(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export interface GoalEditValues {
  id: string;
  sellerLabel: string;
  periodKind: string;
  dayMode: string;
  periodStart: string;
  periodEnd: string;
  targetRevenue: number | null;
  targetOrders: number | null;
  targetNewCustomers: number | null;
}

const brl = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function GoalForm({
  sellers,
  defaultMonth,
  edit,
}: {
  sellers: { id: string; name: string }[];
  defaultMonth: string;
  /** Quando informado, o formulário edita a meta existente (PATCH). */
  edit?: GoalEditValues;
}) {
  const router = useRouter();
  const range = monthRange(defaultMonth);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sellerId: "",
    periodKind: edit?.periodKind ?? "MENSAL",
    dayMode: edit?.dayMode ?? "CORRIDOS",
    periodStart: edit?.periodStart ?? range.start,
    periodEnd: edit?.periodEnd ?? range.end,
    targetRevenue: brl(edit?.targetRevenue ?? null),
    targetOrders: edit?.targetOrders?.toString() ?? "",
    targetNewCustomers: edit?.targetNewCustomers?.toString() ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(edit ? `/api/goals/${edit.id}` : "/api/goals", {
      method: edit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(edit ? {} : { sellerId: form.sellerId || null }),
        periodKind: form.periodKind,
        dayMode: form.dayMode,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        targetRevenue: parseBRL(form.targetRevenue),
        targetOrders: form.targetOrders ? Number(form.targetOrders) : null,
        targetNewCustomers: form.targetNewCustomers ? Number(form.targetNewCustomers) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.issues?.[0]?.message ?? data.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    if (!edit) setForm((f) => ({ ...f, targetRevenue: "", targetOrders: "", targetNewCustomers: "" }));
    router.refresh();
  }

  if (!open && edit) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Button>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{edit ? `Editar meta · ${edit.sellerLabel}` : "Nova meta"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="seller">Responsável</Label>
            <Select id="seller" value={form.sellerId} onChange={set("sellerId")} disabled={!!edit} title={edit ? "O responsável não muda na edição" : undefined}>
              {edit && <option value="">{edit.sellerLabel}</option>}
              {!edit && <option value="">Empresa (meta geral)</option>}
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="kind">Tipo</Label>
            <Select id="kind" value={form.periodKind} onChange={set("periodKind")}>
              <option value="MENSAL">Mensal</option>
              <option value="SEMANAL">Semanal</option>
              <option value="PERSONALIZADO">Personalizada</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="mode">Cálculo de dias</Label>
            <Select id="mode" value={form.dayMode} onChange={set("dayMode")}>
              <option value="CORRIDOS">Dias corridos</option>
              <option value="UTEIS">Dias úteis</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="start">Início</Label>
            <Input id="start" type="date" required value={form.periodStart} onChange={set("periodStart")} />
          </div>
          <div>
            <Label htmlFor="end">Fim</Label>
            <Input id="end" type="date" required value={form.periodEnd} onChange={set("periodEnd")} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rev">Meta de faturamento (R$)</Label>
            <Input id="rev" inputMode="decimal" placeholder="Ex.: 150.000,00" value={form.targetRevenue} onChange={set("targetRevenue")} />
          </div>
          <div>
            <Label htmlFor="orders">Meta de pedidos</Label>
            <Input id="orders" type="number" min={0} value={form.targetOrders} onChange={set("targetOrders")} />
          </div>
          <div>
            <Label htmlFor="new">Meta de novos clientes</Label>
            <Input id="new" type="number" min={0} value={form.targetNewCustomers} onChange={set("targetNewCustomers")} />
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger md:col-span-4">{error}</p>}
          <div className="flex justify-end gap-2 md:col-span-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar meta"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function DeleteGoalButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Excluir esta meta?")) return;
        setBusy(true);
        await fetch(`/api/goals/${id}`, { method: "DELETE" });
        setBusy(false);
        router.refresh();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" /> Excluir
    </Button>
  );
}
