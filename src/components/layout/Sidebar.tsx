"use client";

import {
  BarChart3,
  Boxes,
  Bot,
  FileText,
  LayoutDashboard,
  PlugZap,
  ShoppingBag,
  Store,
  Tag,
  Target,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission, Role } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
  phase?: number; // módulo ainda não disponível
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Visão geral",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    section: "Comercial",
    items: [
      { href: "/vendedores", label: "Vendedores", icon: BarChart3, roles: ["ADMIN", "GESTOR"] },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { href: "#", label: "Clientes", icon: Store, phase: 4 },
      { href: "#", label: "Promoções", icon: Tag, phase: 4, roles: ["ADMIN", "GESTOR"] },
    ],
  },
  {
    section: "Operação",
    items: [
      { href: "#", label: "Estoque", icon: Boxes, phase: 3, roles: ["ADMIN", "GESTOR"] },
      { href: "#", label: "Financeiro", icon: Wallet, phase: 5, roles: ["ADMIN"] },
      { href: "#", label: "Relatórios", icon: FileText, phase: 5, roles: ["ADMIN", "GESTOR"] },
      { href: "#", label: "Pet Intelligence AI", icon: Bot, phase: 6 },
    ],
  },
  {
    section: "Administração",
    items: [
      { href: "/integracao", label: "Integração PedidoOK", icon: PlugZap, roles: ["ADMIN"] },
      { href: "/usuarios", label: "Usuários", icon: UserCog, roles: ["ADMIN"] },
    ],
  },
];

export function Sidebar({ role, name }: { role: Role; name: string; permissions?: Permission[] }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-navy-900 text-navy-100">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || i.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={group.section}>
              <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-navy-300/80">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = item.href !== "#" && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
                  const Icon = item.icon;
                  if (item.phase) {
                    return (
                      <li key={item.label}>
                        <span
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-navy-300/60"
                          title={`Disponível na Fase ${item.phase}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1">{item.label}</span>
                          <span className="rounded bg-white/5 px-1.5 text-[10px]">Fase {item.phase}</span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className={cn(
                          "nav-item relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-all duration-200",
                          active ? "bg-white font-medium text-navy-900 shadow-sm" : "text-navy-100 hover:translate-x-0.5 hover:bg-white/10",
                        )}
                      >
                        {active && <span className="animate-pop absolute -left-3 top-1.5 h-5 w-1 rounded-r-full bg-white" aria-hidden />}
                        <Icon className="nav-icon h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-2.5 border-t border-white/10 px-5 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm text-white">{name}</p>
          <p className="text-[11px] text-navy-300">{role === "ADMIN" ? "Administrador" : role === "GESTOR" ? "Gestor" : "Vendedor"}</p>
        </div>
      </div>
    </aside>
  );
}
