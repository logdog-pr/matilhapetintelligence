"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MESSAGES: Record<string, string> = {
  "sem-acesso": "Seu login foi aceito, mas o usuário não está ativo no Pet Intelligence. Fale com o administrador.",
};

/** Só permite redirecionar para caminhos internos (evita open redirect). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mostra avisos vindos de redirecionamentos do servidor (ex.: ?erro=sem-acesso)
  useEffect(() => {
    const code = params.get("erro");
    if (code && MESSAGES[code]) setError(MESSAGES[code]);
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError("E-mail ou senha inválidos.");
      return;
    }
    // Navegação completa: garante que o servidor receba o cookie da nova sessão.
    window.location.assign(safeNext(params.get("next")));
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
