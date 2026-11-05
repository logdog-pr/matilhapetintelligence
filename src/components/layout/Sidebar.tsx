"use client";

import {
  BarChart3,
  Boxes,
  Bot,
  ChevronsLeft,
  FileText,
  LayoutDashboard,
  PlugZap,
  ShoppingBag,
  Store,
  Tag,
  Target,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth/rbac";
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
      { href: "/clientes", label: "Clientes", icon: Store },
      { href: "/promocoes", label: "Promoções", icon: Tag, roles: ["ADMIN", "GESTOR"] },
    ],
  },
  {
    section: "Operação",
    items: [
      { href: "/estoque", label: "Estoque", icon: Boxes, roles: ["ADMIN", "GESTOR"] },
      { href: "#", label: "Financeiro", icon: Wallet, phase: 5, roles: ["ADMIN"] },
      { href: "#", label: "Relatórios", icon: FileText, phase: 5, roles: ["ADMIN", "GESTOR"] },
      { href: "/assistente", label: "Pet Intelligence AI", icon: Bot },
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * Sidebar azul-marinho.
 * - Desktop: pode ser recolhida (só ícones, com o nome no tooltip).
 * - Celular: vira um menu deslizante (mobileOpen), fechado ao navegar.
 */
export function Sidebar({
  role,
  name,
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
}: {
  role: Role;
  name: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const roleLabel = role === "ADMIN" ? "Administrador" : role === "GESTOR" ? "Gestor" : "Vendedor";

  return (
    <>
      {/* fundo escurecido no celular */}
      <div
        className={cn("fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-[1px] transition-opacity lg:hidden", mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onCloseMobile}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col bg-navy-900 text-navy-100 transition-[width,transform] duration-300 ease-out lg:relative lg:z-30 lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-60",
          "w-64",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
        aria-label="Menu principal"
      >
        <div className={cn("flex items-center py-5", collapsed ? "lg:justify-center lg:px-0" : "", "justify-between px-5")}>
          <span className={cn(collapsed && "lg:hidden")}>
            <Logo />
          </span>
          {collapsed && (
            <span className="hidden lg:block">
              <Logo compact />
            </span>
          )}
          <button onClick={onCloseMobile} className="rounded-md p-1 text-navy-300 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className={cn("flex-1 space-y-5 overflow-y-auto pb-4", collapsed ? "px-3 lg:overflow-visible lg:px-2.5" : "px-3")}>
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.roles || i.roles.includes(role));
            if (items.length === 0) return null;
            return (
              <div key={group.section}>
                <p className={cn("px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-navy-300/80", collapsed && "lg:sr-only")}>{group.section}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.href !== "#" && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
                    const Icon = item.icon;
                    if (item.phase) {
                      return (
                        <li key={item.label}>
                          <span
                            className={cn("flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-navy-300/60", collapsed && "lg:justify-center")}
                            title={`${item.label}: disponível na Fase ${item.phase}`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className={cn("flex-1", collapsed && "lg:hidden")}>{item.label}</span>
                            <span className={cn("rounded bg-white/5 px-1.5 text-[10px]", collapsed && "lg:hidden")}>Fase {item.phase}</span>
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          onClick={onCloseMobile}
                          title={collapsed ? item.label : undefined}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "nav-item group/nav relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-all duration-200",
                            collapsed && "lg:justify-center lg:px-0 lg:py-2",
                            active ? "bg-white font-medium text-navy-900 shadow-sm" : "text-navy-100 hover:translate-x-0.5 hover:bg-white/10",
                          )}
                        >
                          {active && <span className="animate-pop absolute -left-3 top-1.5 h-5 w-1 rounded-r-full bg-white lg:-left-2.5" aria-hidden />}
                          <Icon className="nav-icon h-4 w-4 shrink-0" />
                          <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                          {/* tooltip do modo recolhido */}
                          {collapsed && (
                            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md bg-navy-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100 lg:block">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className={cn("flex items-center gap-2.5 border-t border-white/10 py-4", collapsed ? "px-5 lg:justify-center lg:px-0" : "px-5")}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-navy-900" title={`${name} · ${roleLabel}`}>
            {initials(name) || "?"}
          </span>
          <div className={cn("min-w-0 flex-1 leading-tight", collapsed && "lg:hidden")}>
            <p className="truncate text-sm text-white">{name}</p>
            <p className="text-[11px] text-navy-300">{roleLabel}</p>
          </div>
        </div>

        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="absolute -right-3 top-6 hidden h-6 w-6 place-items-center rounded-full border border-navy-100 bg-white text-navy-700 shadow-sm transition-transform hover:scale-110 lg:grid"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <ChevronsLeft className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        )}
      </aside>
    </>
  );
}
