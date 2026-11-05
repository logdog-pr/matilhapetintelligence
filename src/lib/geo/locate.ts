import "server-only";
import data from "./municipios.json";

/**
 * Localização aproximada por cidade/UF a partir da base de municípios do IBGE
 * (coordenada da sede do município). Usada quando o cliente não tem latitude/longitude.
 */
type Geo = { states: Record<string, [number, number]>; cities: Record<string, Record<string, [number, number]>> };
const geo = data as unknown as Geo;

export function normalizeCity(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['`´-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Precision = "exata" | "cidade" | "sem_localizacao";

export function locate(input: { latitude: number | null; longitude: number | null; city: string | null; state: string | null }): {
  lat: number;
  lng: number;
  precision: Precision;
} | null {
  if (input.latitude !== null && input.longitude !== null) return { lat: input.latitude, lng: input.longitude, precision: "exata" };
  const uf = input.state?.trim().toUpperCase();
  if (!uf || !input.city) return null;
  const hit = geo.cities[uf]?.[normalizeCity(input.city)];
  return hit ? { lat: hit[0], lng: hit[1], precision: "cidade" } : null;
}
