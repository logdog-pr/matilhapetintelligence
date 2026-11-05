/**
 * Tokens dos gráficos (validados com o validador de paleta do dataviz):
 * - SERIES: azul royal da família azul-marinho — passa faixa de luminosidade,
 *   croma e contraste ≥ 3:1 no fundo branco. O azul-marinho da marca é escuro
 *   demais para marcas de dados (lê como cinza), então fica para texto/UI.
 * - PREVIOUS: cinza de ênfase/desênfase para o período anterior (sempre com
 *   legenda + tooltip, pois fica abaixo de 3:1).
 */
export const CHART = {
  series: "#2f5fc4",
  previous: "#a3adbd",
  grid: "#eef2f8",
  axis: "#5b6b85",
  text: "#0a1a33",
  muted: "#5b6b85",
  surface: "#ffffff",
} as const;

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Ticks do eixo: completo abaixo de 10 mil, compacto acima (um estilo por eixo). */
export function axisMoney(max: number) {
  return (v: number) => (max >= 10_000 ? `R$ ${compact.format(v)}` : `R$ ${full.format(v)}`);
}

export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const shortMonth = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]}/${ym.slice(2, 4)}`;
