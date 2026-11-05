import type { Metadata } from "next";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Table, td, th } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { configStatus } from "@/lib/env";
import { formatDateTime, formatInt } from "@/lib/format";
import { RESOURCE_LABELS, type ResourceKey } from "@/lib/pedidook/resources";
import { getRecentSyncLogs, getSyncHealth, type Freshness } from "@/lib/queries/sync-health";
import { SyncActions } from "./SyncActions";

export const metadata: Metadata = { title: "Integração PedidoOK" };

const FRESH: Record<Freshness, { label: string; tone: "success" | "warning" | "neutral" }> = {
  atualizado: { label: "Atualizado", tone: "success" },
  parcial: { label: "Parcial", tone: "warning" },
  desatualizado: { label: "Desatualizado", tone: "warning" },
  indisponivel: { label: "Indisponível", tone: "neutral" },
};

const LOG_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  success: { label: "Sucesso", tone: "success" },
  partial: { label: "Parcial", tone: "warning" },
  error: { label: "Erro", tone: "danger" },
  running: { label: "Em andamento", tone: "neutral" },
  idle: { label: "—", tone: "neutral" },
};

export default async function IntegrationPage() {
  await requirePageUser("integration:view");
  const db = getDb();
  const [health, logs] = await Promise.all([getSyncHealth(db), getRecentSyncLogs(db, 25)]);
  const credentials = configStatus().pedidook;
  const neverImported = health.resources.every((r) => !r.lastSuccessfulSync);
  const errors = logs.filter((l) => l.status === "error").slice(0, 5);

  return (
    <>
      <PageHeader
        title="Integração PedidoOK"
        description="Somente leitura · api.pedidook.com.br/v1 · sincronização incremental por alterado_apos"
        actions={<SyncActions disabled={!credentials} neverImported={neverImported} />}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted">Conexão</p>
          <p className="mt-1 text-base font-semibold text-navy-950">{credentials ? "Credenciais configuradas" : "Credenciais ausentes"}</p>
          <p className="mt-1 text-[11px] text-muted">tokens armazenados apenas no servidor</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted">Estado dos dados</p>
          <p className="mt-1">
            <Badge tone={FRESH[health.overall].tone}>{FRESH[health.overall].label}</Badge>
          </p>
          <p className="mt-2 text-[11px] text-muted">pior estado entre pedidos, clientes, produtos e vendedores</p>
        </Card>
        <Card className="col-span-2 p-5">
          <p className="text-[11px] uppercase tracking-wide text-muted">Requisições hoje</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-navy-950">
            {formatInt(health.requests.usedToday)} <span className="text-sm font-normal text-muted">/ {formatInt(health.requests.budget)} (limite oficial {formatInt(health.requests.officialLimit)})</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
            <div className="h-full bg-navy-700" style={{ width: `${Math.min(100, (health.requests.usedToday / health.requests.budget) * 100)}%` }} />
          </div>
        </Card>
      </div>

      {errors.length > 0 && (
        <Card className="mt-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-danger">Falhas recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.map((l) => (
              <p key={l.id} className="text-sm text-navy-950">
                <span className="font-medium">{RESOURCE_LABELS[l.resource as ResourceKey] ?? l.resource}</span> · {formatDateTime(l.startedAt)} ·{" "}
                <span className="text-muted">{(l.errors as string[]).at(-1)}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recursos sincronizados</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <th className={th}>Recurso</th>
              <th className={th}>Estado</th>
              <th className={`${th} text-right`}>Registros</th>
              <th className={th}>Última sincronização</th>
              <th className={th}>Próxima (prevista)</th>
              <th className={th}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {health.resources.map((r) => (
              <tr key={r.resource}>
                <td className={td}>{r.label}</td>
                <td className={td}>
                  <Badge tone={FRESH[r.freshness].tone}>{FRESH[r.freshness].label}</Badge>
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.rows === null ? "—" : formatInt(r.rows)}</td>
                <td className={`${td} tabular-nums`}>{formatDateTime(r.lastSuccessfulSync)}</td>
                <td className={`${td} tabular-nums text-muted`}>{r.nextSyncAt ? formatDateTime(r.nextSyncAt) : "—"} <span className="text-[11px]">· a cada {r.intervalMinutes} min</span></td>
                <td className={`${td} text-xs text-muted`}>
                  {r.pendingPage ? `Retomará na página ${r.pendingPage}. ` : ""}
                  {r.lastError ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Histórico de execuções</CardTitle>
        </CardHeader>
        {logs.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted">Nenhuma execução registrada.</p>
          </CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Início</th>
                <th className={th}>Recurso</th>
                <th className={th}>Modo</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Lidos</th>
                <th className={`${th} text-right`}>Novos</th>
                <th className={`${th} text-right`}>Atualizados</th>
                <th className={`${th} text-right`}>Requisições</th>
                <th className={th}>Conferência</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const s = LOG_STATUS[l.status] ?? LOG_STATUS.idle;
                const check = l.countCheck as { recordsReadInRun: number; rowsInDatabase: number; ok: boolean } | null;
                return (
                  <tr key={l.id}>
                    <td className={`${td} tabular-nums`}>{formatDateTime(l.startedAt)}</td>
                    <td className={td}>{RESOURCE_LABELS[l.resource as ResourceKey] ?? l.resource}</td>
                    <td className={td}>{l.mode === "full" ? "Histórica" : "Incremental"}</td>
                    <td className={td}>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(l.recordsRead)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(l.recordsCreated)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(l.recordsUpdated)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatInt(l.requestsMade)}</td>
                    <td className={`${td} text-xs`}>
                      {check ? (
                        <span className={check.ok ? "text-success" : "text-warning"}>
                          {formatInt(check.recordsReadInRun)} lidos · {formatInt(check.rowsInDatabase)} no banco
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
