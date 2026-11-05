// Copia o worker do MapLibre para /public (o bundler do Next resolve mal a URL do worker).
// Roda no postinstall, então acompanha sempre a versão instalada.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const src = path.join(dist, "maplibre-gl-worker.mjs");
if (!existsSync(src)) {
  console.warn("[maplibre] worker não encontrado; o mapa pode não carregar.");
  process.exit(0);
}
mkdirSync("public/maplibre", { recursive: true });
copyFileSync(src, "public/maplibre/maplibre-gl-worker.mjs");
console.log("[maplibre] worker copiado para public/maplibre/");
