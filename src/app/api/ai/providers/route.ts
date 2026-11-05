import { apiRoute } from "@/lib/api/handler";
import { listProviders } from "@/lib/ai/chat-service";
import { getDb } from "@/lib/db/client";

/** GET /api/ai/providers — provedores disponíveis, modelo de cada um e o selecionado. */
export const GET = apiRoute({ permission: "ai:use" }, async () => listProviders(getDb()));
