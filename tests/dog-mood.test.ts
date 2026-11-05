import { describe, expect, it } from "vitest";
import { dogLines, dogMood } from "@/components/goal-progress/dogMood";
import { computeGoalProgress } from "@/lib/metrics/goals";

const base = { periodStart: "2026-11-01", periodEnd: "2026-11-30", today: "2026-11-15" };
const g = (target: number, realized: number, today = base.today) => computeGoalProgress({ ...base, today, target, realized });

describe("humor do cachorro da meta", () => {
  it("feliz quando bate a meta ou a projeção passa de 100%", () => {
    expect(dogMood(g(1000, 1200))).toBe("feliz");
    expect(dogMood(g(1000, 600))).toBe("feliz"); // 600 em 15 dias → projeção 1.200 (120%)
    expect(dogLines(g(1000, 1200))[0]).toContain("Meta batida");
  });

  it("normal entre 80% e 100% de projeção", () => {
    expect(dogMood(g(1000, 450))).toBe("normal"); // projeção 900 (90%)
  });

  it("preocupado abaixo de 80% ou período encerrado sem bater", () => {
    const m = g(1000, 300); // projeção 600 (60%)
    expect(dogMood(m)).toBe("preocupado");
    expect(dogLines(m)[0]).toContain("Bora acelerar");
    expect(dogMood(g(1000, 900, "2026-12-05"))).toBe("preocupado");
  });

  it("as falas usam os números reais da meta", () => {
    const lines = dogLines(g(1000, 450));
    expect(lines.join(" ")).toContain("R$ 550,00"); // falta
  });
});
