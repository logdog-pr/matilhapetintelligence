import { formatBRL, formatPercent } from "@/lib/format";
import type { GoalProgress } from "@/lib/metrics/goals";
import type { DogMood } from "./DogRunner";

/**
 * Humor e falas do cachorro a partir dos números da meta.
 * Usa a PROJEÇÃO (estimativa) quando o período está em andamento:
 *  - feliz: meta batida, ou projeção ≥ 100%
 *  - normal: projeção entre 80% e 100%, ou sem projeção
 *  - preocupado: projeção abaixo de 80%, ou período encerrado sem bater a meta
 */
export function dogMood(p: GoalProgress): DogMood {
  const pct = p.percent ?? 0;
  if (pct >= 100) return "feliz";
  if (p.phase === "encerrado") return "preocupado";
  if (p.projectionPercent === null) return "normal";
  if (p.projectionPercent >= 100) return "feliz";
  if (p.projectionPercent >= 80) return "normal";
  return "preocupado";
}

/** Frases do cachorro (a primeira é a principal; as demais aparecem ao clicar). */
export function dogLines(p: GoalProgress): string[] {
  const pct = p.percent ?? 0;
  const falta = p.remaining === null ? null : formatBRL(p.remaining);
  const porDia = p.dailyNeeded === null ? null : formatBRL(p.dailyNeeded);
  const proj = p.projectionPercent === null ? null : formatPercent(p.projectionPercent);

  if (pct >= 100) {
    return [
      `Au au! Meta batida${p.exceededBy ? ` com ${formatBRL(p.exceededBy)} a mais` : ""}!`,
      "Isso merece um osso. 🦴",
      `Já são ${formatPercent(pct)} da meta. Que matilha!`,
    ];
  }
  if (p.phase === "encerrado") {
    return [`O período acabou em ${formatPercent(pct)} da meta.`, falta ? `Faltaram ${falta}. Próximo mês a gente pega!` : "Próximo mês a gente pega!"];
  }
  if (p.phase === "futuro") {
    return ["Essa meta ainda não começou. Tô só aquecendo as patas.", `Vamos precisar de ${porDia ?? "—"} por dia.`];
  }
  const mood = dogMood(p);
  if (mood === "feliz") {
    return [
      `No ritmo! A projeção é de ${proj} da meta.`,
      falta ? `Faltam ${falta}. Tá tranquilo!` : "Tá tranquilo!",
      "Mantendo esse passo, o osso é nosso. 🦴",
    ];
  }
  if (mood === "normal") {
    return [
      falta ? `Quase lá: faltam ${falta}.` : "Seguindo firme.",
      porDia ? `Precisamos de ${porDia} por dia até o fim (${p.daysRemaining} dia(s)).` : "Vamos que vamos!",
      proj ? `Projeção atual: ${proj} da meta. Dá pra virar!` : "Cada pedido conta!",
    ];
  }
  return [
    falta ? `Bora acelerar? Faltam ${falta}.` : "Bora acelerar?",
    porDia ? `São ${porDia} por dia nos ${p.daysRemaining} dia(s) que restam.` : "Cada pedido conta!",
    proj ? `No ritmo atual, fechamos em ${proj}. Que tal ligar pros clientes em risco?` : "Que tal ligar pros clientes em risco?",
  ];
}
