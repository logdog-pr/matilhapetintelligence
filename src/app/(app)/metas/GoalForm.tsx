"use client";

import { Plus, Trash2 } from "lucide-react";
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

export function GoalForm({ sellers, defaultMonth }: { sellers: { id: string; name: string }[]; defaultMonth: string }) {
  const router = useRouter();
  const range = monthRange(defaultMonth);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sellerId: "",
    periodKind: "MENSAL",
    dayMode: "CORRIDOS",
    periodStart: range.start,
    periodEnd: range.end,
    targetRevenue: "",
    targetOrders: "",
    targetNewCustomers: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: form.sellerId || null,
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
    setForm((f) => ({ ...f, targetRevenue: "", targetOrders: "", targetNewCustomers: "" }));
    router.refresh();
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
        <CardTitle>Nova meta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="seller">Responsável</Label>
            <Select id="seller" value={form.sellerId} onChange={set("sellerId")}>
              <option value="">Empresa (meta geral)</option>
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
