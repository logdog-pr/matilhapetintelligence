import type { Metadata } from "next";
import { Suspense } from "react";
import { DogRunner } from "@/components/goal-progress/DogRunner";
import { Logo } from "@/components/layout/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy-900 p-10 lg:flex">
        <Logo />
        <div>
          <DogRunner pose="sit" />
          <h1 className="mt-6 max-w-sm text-2xl font-semibold leading-snug text-white">
            Os números da distribuidora, claros e confiáveis.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-navy-300">
            Vendas, metas, estoque e clientes a partir dos dados oficiais do PedidoOK.
          </p>
        </div>
        <p className="text-xs text-navy-300">Modo somente leitura no PedidoOK.</p>
      </section>
      <section className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-navy-950">Entrar</h2>
          <p className="mt-1 text-sm text-muted">Use o e-mail cadastrado pelo administrador.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
