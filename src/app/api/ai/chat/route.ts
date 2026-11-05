import { apiRoute } from "@/lib/api/handler";
import { chat, chatInputSchema } from "@/lib/ai/chat-service";
import { getDb } from "@/lib/db/client";

export const maxDuration = 120;

/** POST /api/ai/chat — pergunta ao Pet Intelligence AI (ferramentas respeitam o perfil). */
export const POST = apiRoute({ permission: "ai:use", rateLimit: { limit: 20, windowMs: 60_000 } }, async ({ req, user }) => {
  const body = chatInputSchema.parse(await req.json());
  return chat(getDb(), user, body);
});
