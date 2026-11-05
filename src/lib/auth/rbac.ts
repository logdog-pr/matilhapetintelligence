/**
 * RBAC — papéis e permissões (spec §4). Módulo puro, usado no backend.
 * A interface pode esconder itens, mas a autorização SEMPRE é validada no servidor.
 */
export type Role = "ADMIN" | "GESTOR" | "VENDEDOR";

export type Permission =
  | "dashboard:view"
  | "dashboard:company" // números consolidados da empresa
  | "goals:view"
  | "goals:view_all" // metas de todos os vendedores e da empresa
  | "goals:manage"
  | "sellers:view_all"
  | "customers:view" // inteligência de clientes (vendedor: só os próprios)
  | "promotions:view" // sugestões de promoção (mostram custo e margem)
  | "promotions:manage" // gerar, aprovar e rejeitar sugestões
  | "stock:view" // módulo de estoque (custos de aquisição)
  | "stock:manage" // prazos de fornecedores e parâmetros de reposição
  | "integration:view"
  | "integration:manage"
  | "users:manage"
  | "settings:manage"
  | "search:use"
  | "ai:use" // Pet Intelligence AI (ferramentas respeitam as demais permissões)
  | "ai:manage"; // escolher provedor/modelo da IA

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "dashboard:view",
    "dashboard:company",
    "goals:view",
    "goals:view_all",
    "goals:manage",
    "sellers:view_all",
    "customers:view",
    "promotions:view",
    "promotions:manage",
    "stock:view",
    "stock:manage",
    "integration:view",
    "integration:manage",
    "users:manage",
    "settings:manage",
    "search:use",
    "ai:use",
    "ai:manage",
  ],
  GESTOR: [
    "dashboard:view",
    "dashboard:company",
    "goals:view",
    "goals:view_all",
    "sellers:view_all",
    "customers:view",
    "promotions:view",
    "promotions:manage",
    "stock:view",
    "search:use",
    "ai:use",
  ],
  VENDEDOR: ["dashboard:view", "goals:view", "customers:view", "search:use", "ai:use"],
};

export interface Principal {
  id: string;
  role: Role;
  sellerId: string | null;
}

export function can(user: Pick<Principal, "role"> | null | undefined, permission: Permission): boolean {
  return !!user && ROLE_PERMISSIONS[user.role].includes(permission);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function assertCan(user: Principal | null, permission: Permission): asserts user is Principal {
  if (!user) throw new HttpError(401, "Não autenticado.");
  if (!can(user, permission)) throw new HttpError(403, "Acesso não permitido para o seu perfil.");
}

/**
 * Escopo de vendedor para consultas.
 * - VENDEDOR: sempre o próprio seller_id. Pedir outro vendedor (ou a empresa) → 403.
 *   Sem vendedor vinculado → 403 (não há dados próprios para mostrar).
 * - ADMIN/GESTOR: o vendedor solicitado, ou null (empresa inteira).
 */
export function scopeSellerId(user: Principal, requested: string | null | undefined): string | null {
  if (user.role === "VENDEDOR") {
    if (!user.sellerId) throw new HttpError(403, "Usuário vendedor sem vendedor do PedidoOK vinculado.");
    if (requested && requested !== user.sellerId) throw new HttpError(403, "Vendedores só podem consultar os próprios dados.");
    return user.sellerId;
  }
  return requested ?? null;
}
