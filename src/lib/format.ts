/**
 * Formatação padrão do sistema: pt-BR, BRL, DD/MM/AAAA, America/Sao_Paulo.
 * Datas de negócio (emissão, vencimento, períodos de meta) são tratadas como
 * strings ISO "YYYY-MM-DD" para evitar deslocamentos de fuso.
 */

export const TIME_ZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? brl.format(n) : "—";
}

export function formatInt(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : int.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${pct.format(value)}%`;
}

/** "2026-11-04" → "04/11/2026" */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/** Instante (Date/ISO com fuso) → "DD/MM/AAAA HH:MM" em America/Sao_Paulo */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Primeiro e último dia do mês de uma data ISO. */
export function monthBounds(isoDate: string): { start: string; end: string } {
  const [y, m] = isoDate.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

export function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
