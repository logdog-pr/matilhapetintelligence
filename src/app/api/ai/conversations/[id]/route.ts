import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { deleteConversation, getConversation } from "@/lib/ai/chat-service";
import { getDb } from "@/lib/db/client";

const id = z.uuid();

/** GET /api/ai/conversations/:id — mensagens de uma conversa do próprio usuário. */
export const GET = apiRoute<{ id: string }>({ permission: "ai:use" }, async ({ user, params }) => getConversation(getDb(), user, id.parse(params.id)));

/** DELETE /api/ai/conversations/:id */
export const DELETE = apiRoute<{ id: string }>({ permission: "ai:use" }, async ({ user, params }) => deleteConversation(getDb(), user, id.parse(params.id)));
