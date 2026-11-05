import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const optionalNonNegative = z.number().nonnegative().nullable().optional();

export const goalBaseSchema = z.object({
  sellerId: z.uuid().nullable(),
  periodKind: z.enum(["MENSAL", "SEMANAL", "PERSONALIZADO"]),
  dayMode: z.enum(["CORRIDOS", "UTEIS"]).default("CORRIDOS"),
  periodStart: isoDate,
  periodEnd: isoDate,
  targetRevenue: optionalNonNegative,
  targetOrders: z.number().int().nonnegative().nullable().optional(),
  targetNewCustomers: z.number().int().nonnegative().nullable().optional(),
});

const refine = <T extends z.ZodType<Partial<z.infer<typeof goalBaseSchema>>>>(s: T) =>
  s
    .refine((g) => !g.periodStart || !g.periodEnd || g.periodStart <= g.periodEnd, {
      message: "A data inicial deve ser anterior ou igual à final.",
      path: ["periodEnd"],
    });

export const createGoalSchema = refine(goalBaseSchema).refine(
  (g) => [g.targetRevenue, g.targetOrders, g.targetNewCustomers].some((v) => v !== null && v !== undefined),
  { message: "Informe ao menos um alvo (faturamento, pedidos ou novos clientes).", path: ["targetRevenue"] },
);

export const updateGoalSchema = refine(goalBaseSchema.partial());

export const goalsQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  seller_id: z.uuid().optional(),
});
