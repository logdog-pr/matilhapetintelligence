"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface HeatPoint {
  id: string | null;
  name: string;
  city: string | null;
  state: string | null;
  clsLabel: string;
  revenue: number;
  monthly: number;
  lat: number;
  lng: number;
  precision: "exata" | "cidade";
}

/** Mapa-base claro, gratuito e sem chave (OpenFreeMap / OpenStreetMap). */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** Rampa sequencial de um tom (azul), transparente → escuro. */
const RAMP = ["rgba(205,226,251,0)", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#104281"];
const BRAZIL: [[number, number], [number, number]] = [
  [-74, -34],
  [-34, 5.5],
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Deslocamento determinístico (~até 1,5 km) para pontos aproximados pelo centro da cidade. */
function jitter(p: HeatPoint, i: number): [number, number] {
  if (p.precision === "exata") return [p.lng, p.lat];
  let h = 2166136261;
  for (const ch of `${p.id ?? p.name}${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = ((h >>> 0) % 360) * (Math.PI / 180);
  const r = (((h >>> 9) % 1000) / 1000) * 0.014;
  return [p.lng + Math.cos(a) * r, p.lat + Math.sin(a) * r];
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function CustomerHeatMap({ points, emptyMessage }: { points: HeatPoint[]; emptyMessage?: { title: string; description: string } }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [mode, setMode] = useState<"clientes" | "faturamento">("clientes");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const maxRevenue = useMemo(() => Math.max(1, ...points.map((p) => p.revenue)), [points]);
  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points.map((p, i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: jitter(p, i) },
        properties: {
          id: p.id ?? "",
          name: p.name,
          place: [p.city, p.state].filter(Boolean).join("/"),
          cls: p.clsLabel,
          revenue: p.revenue,
          monthly: p.monthly,
          w: Math.sqrt(p.revenue / maxRevenue),
          approx: p.precision === "cidade" ? 1 : 0,
        },
      })),
    }),
    [points, maxRevenue],
  );

  // Inicializa o mapa uma vez
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        // Worker servido como arquivo estático (copiado no postinstall)
        ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map = new ml.Map({
          container: container.current,
          style: STYLE_URL,
          bounds: BRAZIL,
          fitBoundsOptions: { padding: 24 },
          attributionControl: { compact: true },
          fadeDuration: reduced ? 0 : 300,
        });
        mapRef.current = map;
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", (e) => {
          console.warn("[mapa]", e?.error?.message ?? e);
          if (String(e?.error?.message ?? "").includes("Failed to fetch")) setError("Não foi possível carregar o mapa-base (sem conexão com o servidor de mapas).");
        });
        map.on("load", () => {
          if (!map) return;
          map.addSource("clientes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          // Rótulos do mapa-base em português quando houver (senão, o nome local)
          for (const layer of map.getStyle().layers ?? []) {
            if (layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field")) {
              map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:pt"], ["get", "name"]]);
            }
          }
          // Desenha abaixo dos rótulos do mapa-base, para os nomes das cidades continuarem legíveis
          const firstLabel = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
          map.addLayer({
            id: "calor",
            type: "heatmap",
            source: "clientes",
            maxzoom: 13,
            paint: {
              "heatmap-weight": 1,
              // Intensidade baixa no zoom distante para não saturar cidades com muitos clientes
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.08, 6, 0.18, 9, 0.5, 12, 1.2],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 6, 30, 9, 42, 12, 52],
              "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, RAMP[0], 0.12, RAMP[1], 0.3, RAMP[2], 0.5, RAMP[3], 0.75, RAMP[4], 1, RAMP[5]],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 0],
            },
          }, firstLabel);
          map.addLayer({
            id: "pontos",
            type: "circle",
            source: "clientes",
            minzoom: 8,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 13, 8],
              "circle-color": ["case", ["==", ["get", "approx"], 1], "#3b5b92", "#0f2647"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 10, 1],
              "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 10, 1],
            },
          }, firstLabel);
          map.on("mouseenter", "pontos", () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "pontos", () => (map!.getCanvas().style.cursor = ""));
          map.on("click", "pontos", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties as Record<string, string | number>;
            const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
            const html = `
              <div style="font-family:var(--font-sans);min-width:190px">
                <div style="font-weight:600;color:#0a1a33">${escapeHtml(String(p.name))}</div>
                <div style="font-size:12px;color:#5b6b85">${escapeHtml(String(p.place))} · ${escapeHtml(String(p.cls))}</div>
                <div style="font-size:12px;margin-top:6px;color:#0a1a33">Faturamento acumulado: <b>${brl(Number(p.revenue))}</b></div>
                <div style="font-size:12px;color:#0a1a33">Média mensal: <b>${brl(Number(p.monthly))}</b></div>
                ${Number(p.approx) ? '<div style="font-size:11px;color:#9a6a00;margin-top:4px">Posição aproximada (centro da cidade)</div>' : ""}
                ${p.id ? `<a href="/clientes/${encodeURIComponent(String(p.id))}" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:600;color:#1e3a6b">Ver cliente →</a>` : ""}
              </div>`;
            new ml.Popup({ closeButton: true, maxWidth: "260px" }).setLngLat(coords).setHTML(html).addTo(map!);
          });
          setReady(true);
        });
      } catch (e) {
        setError(`Falha ao iniciar o mapa: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualiza dados e enquadra
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("clientes") as GeoJSONSource | undefined)?.setData(geojson);
    if (points.length) {
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 11, duration: reduced ? 0 : 900 },
      );
    }
  }, [ready, geojson, points]);

  // Peso do calor: quantidade de clientes ou faturamento
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setPaintProperty("calor", "heatmap-weight", mode === "faturamento" ? ["get", "w"] : 1);
  }, [ready, mode]);

  return (
    <div className="relative h-[560px] overflow-hidden rounded-xl border border-navy-100 bg-navy-50">
      {/* O CSS do MapLibre força position:relative no container: usar tamanho explícito */}
      <div ref={container} className="h-full w-full" aria-label="Mapa de calor de clientes" role="region" />

      <div className="absolute left-3 top-3 z-10 flex rounded-lg border border-navy-100 bg-white/95 p-1 shadow-sm backdrop-blur" role="group" aria-label="Peso do mapa de calor">
        {(["clientes", "faturamento"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-all", mode === m ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50")}
          >
            {m === "clientes" ? "Quantidade de clientes" : "Faturamento"}
          </button>
        ))}
      </div>

      <div className="absolute bottom-8 left-3 z-10 rounded-lg border border-navy-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <p className="mb-1 text-[11px] font-medium text-navy-950">{mode === "clientes" ? "Concentração de clientes" : "Concentração de faturamento"}</p>
        <div className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(to right, ${RAMP.slice(1).join(",")})` }} />
        <div className="mt-0.5 flex justify-between text-[10px] text-muted">
          <span>menos</span>
          <span>mais</span>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-navy-900 ring-2 ring-white" /> local exato
          <span className="ml-2 inline-block h-2 w-2 rounded-full ring-2 ring-white" style={{ background: "#3b5b92" }} /> centro da cidade
        </p>
        <p className="text-[10px] text-muted">aproxime para ver cada cliente</p>
      </div>

      {error && (
        <div className="absolute inset-x-3 top-14 z-10 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-warning">{error}</div>
      )}
      {!ready && !error && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Carregando mapa…</div>}
      {ready && points.length === 0 && emptyMessage && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="animate-pop max-w-sm rounded-xl border border-navy-100 bg-white/95 px-5 py-4 text-center shadow-sm backdrop-blur">
            <p className="text-sm font-semibold text-navy-950">{emptyMessage.title}</p>
            <p className="mt-1 text-xs text-muted">{emptyMessage.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
