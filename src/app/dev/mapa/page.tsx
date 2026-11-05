import { notFound } from "next/navigation";
import { CustomerHeatMap, type HeatPoint } from "@/components/customers/CustomerHeatMap";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/primitives";
import { locate } from "@/lib/geo/locate";

/** Demonstração — SOMENTE em desenvolvimento. Clientes FICTÍCIOS em cidades reais. */
export default function MapPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const cities: [string, string, number][] = [
    ["Campinas", "SP", 38], ["São Paulo", "SP", 55], ["Sorocaba", "SP", 17], ["Jundiaí", "SP", 14], ["Piracicaba", "SP", 11],
    ["Ribeirão Preto", "SP", 9], ["Americana", "SP", 12], ["Valinhos", "SP", 7], ["Santos", "SP", 8], ["São José dos Campos", "SP", 10],
    ["Bauru", "SP", 5], ["Limeira", "SP", 8], ["Indaiatuba", "SP", 9], ["Curitiba", "PR", 12], ["Londrina", "PR", 4],
    ["Belo Horizonte", "MG", 9], ["Poços de Caldas", "MG", 6], ["Rio de Janeiro", "RJ", 7], ["Uberlândia", "MG", 3], ["Goiânia", "GO", 2],
  ];
  const points: HeatPoint[] = [];
  let n = 0;
  for (const [city, uf, count] of cities) {
    const loc = locate({ latitude: null, longitude: null, city, state: uf })!;
    for (let i = 0; i < count; i++) {
      n++;
      const exact = i % 3 === 0;
      points.push({
        id: null, name: `Cliente exemplo ${n}`, city, state: uf, clsLabel: ["Ativo", "Recorrente", "Em risco", "Inativo"][n % 4],
        revenue: 2000 + ((n * 7919) % 48000), monthly: 300 + ((n * 131) % 4000),
        lat: exact ? loc.lat + (((n * 37) % 100) - 50) / 900 : loc.lat, lng: exact ? loc.lng + (((n * 53) % 100) - 50) / 900 : loc.lng,
        precision: exact ? "exata" : "cidade",
      });
    }
  }
  return (
    <AppShell role="ADMIN" name="Administrador (exemplo)" freshness="atualizado" lastSync={new Date()}>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-warning">Exemplo visual: clientes fictícios em cidades reais. Esta página não existe em produção.</div>
      <PageHeader title="Mapa de clientes (exemplo)" description={`${points.length} clientes fictícios`} />
      <CustomerHeatMap points={points} />
    </AppShell>
  );
}
