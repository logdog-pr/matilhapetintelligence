import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { listConversations, listProviders } from "@/lib/ai/chat-service";
import { can } from "@/lib/auth/rbac";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AIChat } from "./AIChat";

export const metadata: Metadata = { title: "Pet Intelligence AI" };

export default async function AssistantPage() {
  const user = await requirePageUser("ai:use");
  const db = getDb();
  const [providers, conversations] = await Promise.all([listProviders(db), listConversations(db, user)]);
  const current = providers.providers.find((p) => p.id === providers.current);

  return (
    <>
      <PageHeader
        title="Pet Intelligence AI"
        description="Pergunte sobre vendas, metas, clientes e produtos. As respostas usam os dados reais do sistema, com período e fonte."
      />
      <AIChat
        initialConversations={conversations.map((c) => ({ id: c.id, title: c.title ?? "Conversa", updatedAt: c.updatedAt.toISOString() }))}
        providers={providers}
        configured={!!current?.configured}
        canManage={can(user, "ai:manage")}
        isManager={can(user, "sellers:view_all")}
        sellerWithoutLink={user.role === "VENDEDOR" && !user.sellerId}
      />
    </>
  );
}
