/**
 * Fórmulas de metas (spec §8). Funções puras — sem divisão por zero.
 *
 *   percentual atingido   = realizado / meta × 100
 *   valor restante        = max(0, meta − realizado)
 *   meta diária necessária = (meta − realizado) / dias restantes
 *   projeção de fechamento = realizado / dias decorridos × dias totais   (ESTIMATIVA)
 *
 * Convenção de dias (corridos ou úteis):
 *   - dias totais: do início ao fim do período, inclusive.
 *   - dias decorridos: do início até HOJE, inclusive (limitado ao período).
 *   - dias restantes: de HOJE até o fim, inclusive — o dia de hoje ainda conta
 *     como disponível para vender.
 *   - dias úteis: segunda a sexta, excluindo feriados configurados.
 */

export type DayMode = "CORRIDOS" | "UTEIS";

export interface GoalInput {
  target: number | null;
  realized: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD (America/Sao_Paulo)
  dayMode?: DayMode;
  holidays?: string[];
}

export interface GoalProgress {
  target: number | null;
  realized: number;
  /** null quando não há meta (> 0) definida */
  percent: number | null;
  remaining: number | null;
  exceededBy: number | null;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  /** null quando não há dias restantes ou a meta já foi batida */
  dailyNeeded: number | null;
  /** null quando o período ainda não começou */
  projection: number | null;
  projectionPercent: number | null;
  phase: "futuro" | "em_andamento" | "encerrado";
  dayMode: DayMode;
}

const DAY = 86_400_000;
const toUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Conta dias entre a e b inclusive (0 se a > b). */
export function countDays(a: string, b: string, mode: DayMode = "CORRIDOS", holidays: string[] = []): number {
  const start = toUTC(a);
  const end = toUTC(b);
  if (start > end) return 0;
  if (mode === "CORRIDOS") return Math.round((end - start) / DAY) + 1;
  const off = new Set(holidays);
  let n = 0;
  for (let d = start; d <= end; d += DAY) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6 && !off.has(toISO(d))) n++;
  }
  return n;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function computeGoalProgress(input: GoalInput): GoalProgress {
  const mode = input.dayMode ?? "CORRIDOS";
  const holidays = input.holidays ?? [];
  const { periodStart: start, periodEnd: end, today } = input;
  const target = input.target !== null && input.target > 0 ? input.target : null;
  const realized = input.realized;

  const phase = today < start ? "futuro" : today > end ? "encerrado" : "em_andamento";
  const daysTotal = countDays(start, end, mode, holidays);
  const elapsedEnd = today > end ? end : today;
  const daysElapsed = phase === "futuro" ? 0 : countDays(start, elapsedEnd, mode, holidays);
  const daysRemaining = phase === "encerrado" ? 0 : countDays(today < start ? start : today, end, mode, holidays);

  const percent = target ? round2((realized / target) * 100) : null;
  const gap = target ? target - realized : null;
  const remaining = gap === null ? null : round2(Math.max(0, gap));
  const exceededBy = gap !== null && gap < 0 ? round2(-gap) : null;
  const dailyNeeded = gap !== null && gap > 0 && daysRemaining > 0 ? round2(gap / daysRemaining) : null;

  let projection: number | null = null;
  if (phase === "encerrado") projection = round2(realized);
  else if (daysElapsed > 0) projection = round2((realized / daysElapsed) * daysTotal);

  return {
    target,
    realized: round2(realized),
    percent,
    remaining,
    exceededBy,
    daysTotal,
    daysElapsed,
    daysRemaining,
    dailyNeeded,
    projection,
    projectionPercent: target && projection !== null ? round2((projection / target) * 100) : null,
    phase,
    dayMode: mode,
  };
}
