/**
 * Filtros de período do dashboard (spec §7) e período de comparação.
 * Todas as datas são strings ISO "YYYY-MM-DD" no fuso de São Paulo.
 */
import { formatDate, monthLabel } from "./format";

export const PERIOD_PRESETS = ["hoje", "7d", "30d", "mes", "mes_anterior", "ano", "personalizado"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Mês atual",
  mes_anterior: "Mês anterior",
  ano: "Ano atual",
  personalizado: "Personalizado",
};

export interface Period {
  preset: PeriodPreset;
  start: string;
  end: string;
  label: string;
  /** Período imediatamente anterior, de mesma natureza, para comparação. */
  previous: { start: string; end: string; label: string };
}

const DAY = 86_400_000;
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toISO(toMs(iso) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY) + 1;
const isISO = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toMs(v));

function lastDayOfMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Mesmo dia no mês anterior (limitado ao último dia daquele mês). */
function sameDayPrevMonth(iso: string) {
  let y = +iso.slice(0, 4);
  let m = +iso.slice(5, 7) - 1;
  if (m === 0) {
    m = 12;
    y--;
  }
  const d = Math.min(+iso.slice(8, 10), lastDayOfMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function shiftBack(start: string, end: string) {
  const len = daysBetween(start, end);
  return { start: addDays(start, -len), end: addDays(start, -1) };
}

const rangeLabel = (s: string, e: string) => (s === e ? formatDate(s) : `${formatDate(s)} a ${formatDate(e)}`);

/**
 * Resolve o período a partir do preset (ou datas personalizadas).
 * Comparações:
 *  - mês atual (parcial) → mesmos dias do mês anterior (ex.: 01–18/11 vs 01–18/10)
 *  - mês anterior → mês retrasado inteiro
 *  - ano atual (parcial) → mesmo intervalo do ano anterior
 *  - demais → janela imediatamente anterior de mesmo tamanho
 */
export function resolvePeriod(
  preset: string | null | undefined,
  today: string,
  custom?: { start?: string | null; end?: string | null },
): Period {
  const p = (PERIOD_PRESETS as readonly string[]).includes(preset ?? "") ? (preset as PeriodPreset) : "mes";
  const y = +today.slice(0, 4);
  const mm = today.slice(5, 7);

  switch (p) {
    case "hoje": {
      const prev = addDays(today, -1);
      return { preset: p, start: today, end: today, label: `Hoje (${formatDate(today)})`, previous: { start: prev, end: prev, label: "Ontem" } };
    }
    case "7d":
    case "30d": {
      const n = p === "7d" ? 7 : 30;
      const start = addDays(today, -(n - 1));
      const prev = shiftBack(start, today);
      return { preset: p, start, end: today, label: PRESET_LABELS[p], previous: { ...prev, label: `${n} dias anteriores` } };
    }
    case "mes": {
      const start = `${y}-${mm}-01`;
      const prevStart = sameDayPrevMonth(start);
      const prevEnd = sameDayPrevMonth(today);
      return {
        preset: p,
        start,
        end: today,
        label: monthLabel(today),
        previous: { start: prevStart, end: prevEnd, label: `Mesmo período de ${monthLabel(prevStart).toLowerCase()}` },
      };
    }
    case "mes_anterior": {
      const ref = sameDayPrevMonth(`${y}-${mm}-01`);
      const ry = +ref.slice(0, 4);
      const rm = +ref.slice(5, 7);
      const start = ref;
      const end = `${ref.slice(0, 7)}-${String(lastDayOfMonth(ry, rm)).padStart(2, "0")}`;
      const pStart = sameDayPrevMonth(start);
      const pEnd = `${pStart.slice(0, 7)}-${String(lastDayOfMonth(+pStart.slice(0, 4), +pStart.slice(5, 7))).padStart(2, "0")}`;
      return { preset: p, start, end, label: monthLabel(start), previous: { start: pStart, end: pEnd, label: monthLabel(pStart) } };
    }
    case "ano": {
      const start = `${y}-01-01`;
      const prevEnd = `${y - 1}${today.slice(4)}`.replace(/-02-29$/, "-02-28");
      return { preset: p, start, end: today, label: `Ano de ${y}`, previous: { start: `${y - 1}-01-01`, end: prevEnd, label: `Mesmo período de ${y - 1}` } };
    }
    case "personalizado": {
      let start = isISO(custom?.start) ? custom!.start! : `${y}-${mm}-01`;
      let end = isISO(custom?.end) ? custom!.end! : today;
      if (start > end) [start, end] = [end, start];
      // limite de 3 anos para proteger o banco
      if (daysBetween(start, end) > 1096) start = addDays(end, -1095);
      const prev = shiftBack(start, end);
      return { preset: p, start, end, label: rangeLabel(start, end), previous: { ...prev, label: `Período anterior (${rangeLabel(prev.start, prev.end)})` } };
    }
  }
}

/** Lista de todas as datas de um intervalo (inclusive). */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Últimos N meses (YYYY-MM) terminando no mês de `endIso`. */
export function lastMonths(endIso: string, n: number): string[] {
  const out: string[] = [];
  let y = +endIso.slice(0, 4);
  let m = +endIso.slice(5, 7);
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}
