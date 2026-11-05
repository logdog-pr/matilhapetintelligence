"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Input, Label, Select, Table, td, th } from "@/components/ui/primitives";

type Role = "ADMIN" | "GESTOR" | "VENDEDOR";
interface Row {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  sellerId: string | null;
  sellerName: string | null;
}

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administrador", GESTOR: "Gestor", VENDEDOR: "Vendedor" };

export function UsersManager({ users, sellers, meId, canCreate }: { users: Row[]; sellers: { id: string; name: string }[]; meId: string; canCreate: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VENDEDOR" as Role, sellerId: "" });

  async function patch(id: string, body: Partial<Pick<Row, "role" | "sellerId" | "active">>) {
    setError(null);
    const res = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Falha ao atualizar.");
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, sellerId: form.sellerId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.issues?.[0]?.message ?? data.error ?? "Falha ao criar usuário.");
      return;
    }
    setCreating(false);
    setForm({ name: "", email: "", password: "", role: "VENDEDOR", sellerId: "" });
    router.refresh();
  }

  return (
    <div>
      {error && <p className="mx-5 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <Table>
        <thead>
          <tr>
            <th className={th}>Nome</th>
            <th className={th}>E-mail</th>
            <th className={th}>Papel</th>
            <th className={th}>Vendedor PedidoOK</th>
            <th className={th}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={td}>
                {u.name} {u.id === meId && <Badge>você</Badge>}
              </td>
              <td className={`${td} text-muted`}>{u.email}</td>
              <td className={td}>
                <Select className="h-8 w-40" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value as Role })}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </td>
              <td className={td}>
                <Select className="h-8 w-48" value={u.sellerId ?? ""} onChange={(e) => patch(u.id, { sellerId: e.target.value || null })}>
                  <option value="">— nenhum —</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </td>
              <td className={td}>
                <Button variant={u.active ? "secondary" : "primary"} size="sm" onClick={() => patch(u.id, { active: !u.active })}>
                  {u.active ? "Ativo · desativar" : "Inativo · ativar"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="p-5">
        {!creating ? (
          <Button onClick={() => setCreating(true)} disabled={!canCreate} title={canCreate ? undefined : "Configure SUPABASE_SERVICE_ROLE_KEY"}>
            <UserPlus className="h-4 w-4" /> Novo usuário
          </Button>
        ) : (
          <form onSubmit={create} className="grid gap-4 md:grid-cols-5">
            <div>
              <Label htmlFor="n">Nome</Label>
              <Input id="n" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="e">E-mail</Label>
              <Input id="e" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="p">Senha inicial</Label>
              <Input id="p" type="password" minLength={10} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="r">Papel</Label>
              <Select id="r" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {Object.entries(ROLE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="s">Vendedor PedidoOK</Label>
              <Select id="s" value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: e.target.value })} required={form.role === "VENDEDOR"}>
                <option value="">— nenhum —</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 md:col-span-5">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar usuário</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
