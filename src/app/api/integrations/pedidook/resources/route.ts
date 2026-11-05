import { apiRoute } from "@/lib/api/handler";
import { LIST_RESOURCES, RESOURCE_LABELS, RESOURCE_ORDER } from "@/lib/pedidook/resources";

/** GET /api/integrations/pedidook/resources — recursos integrados (somente leitura). */
export const GET = apiRoute({ permission: "integration:view" }, async () => ({
  resources: RESOURCE_ORDER.map((key) => ({
    key,
    label: RESOURCE_LABELS[key],
    endpoint: key in LIST_RESOURCES ? `/${LIST_RESOURCES[key as keyof typeof LIST_RESOURCES].path}/` : "/clientes/{id}/vendedores",
    method: "GET",
  })),
}));
