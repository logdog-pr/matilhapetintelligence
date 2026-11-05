import { apiRoute } from "@/lib/api/handler";
import { listConversations } from "@/lib/ai/chat-service";
import { getDb } from "@/lib/db/client";

/** GET /api/ai/conversations — conversas do próprio usuário. */
export const GET = apiRoute({ permission: "ai:use" }, async ({ user }) => listConversations(getDb(), user));
