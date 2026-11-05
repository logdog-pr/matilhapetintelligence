import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda contra "TypeError: u is not a function" no React: um useEffect com corpo
 * de expressão (sem chaves) retorna o valor da expressão. Se não for uma função
 * (ex.: scrollIntoView, que em navegadores novos retorna uma Promise), o React
 * tenta chamá-lo na limpeza e a tela quebra. Só é aceito retornar outra arrow function.
 */
const root = path.resolve(__dirname, "../src");
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));

describe("useEffect não retorna valores que não sejam função", () => {
  it("todo useEffect com corpo de expressão retorna uma função de limpeza", () => {
    const offenders: string[] = [];
    for (const f of walk(root)) {
      const s = fs.readFileSync(f, "utf8");
      for (const m of s.matchAll(/useEffect\(\s*(?:async\s*)?\(\)\s*=>(?!\s*\{)\s*([^\n]{0,60})/g)) {
        if (!/^\(\)\s*=>/.test(m[1].trim())) offenders.push(`${path.relative(root, f)}: ${m[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
