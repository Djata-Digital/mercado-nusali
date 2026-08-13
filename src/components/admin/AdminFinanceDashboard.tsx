import React, {
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Siren,
  X,
} from 'lucide-react';

import { AdminFinanceApi } from '../../api/clients/AdminFinanceApi';

interface Props {
  showToast: (
    message: string,
  ) => void;
}

const dataOf = (
  response: any,
) =>
  response?.data?.data ??
  response?.data ??
  null;

const errorMessage = (
  error: any,
) =>
  error?.response?.data?.error
    ?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const date = (
  value?: string | null,
) => {
  if (!value) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat(
      'pt-BR',
      {
        dateStyle: 'short',
        timeStyle: 'short',
      },
    ).format(
      new Date(value),
    );
  } catch {
    return String(value);
  }
};

export const AdminFinanceDashboard:
React.FC<Props> = ({
  showToast,
}) => {
  const [
    summary,
    setSummary,
  ] = useState<any>(null);

  const [
    readiness,
    setReadiness,
  ] = useState<any>(null);

  const [
    monitoring,
    setMonitoring,
  ] = useState<any>(null);

  const [
    scheduler,
    setScheduler,
  ] = useState<any>(null);

  const [
    incidents,
    setIncidents,
  ] = useState<any[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    operating,
    setOperating,
  ] = useState(false);

  const [
    selectedIncident,
    setSelectedIncident,
  ] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);

      const [
        summaryResponse,
        readinessResponse,
        monitoringResponse,
        schedulerResponse,
        incidentsResponse,
      ] = await Promise.all([
        AdminFinanceApi.reconciliationSummary(),
        AdminFinanceApi.reconciliationReadiness(),
        AdminFinanceApi.reconciliationMonitoring(),
        AdminFinanceApi.reconciliationScheduler(),
        AdminFinanceApi.reconciliationIncidents(
          100,
        ),
      ]);

      setSummary(
        dataOf(
          summaryResponse,
        ),
      );

      setReadiness(
        dataOf(
          readinessResponse,
        ),
      );

      setMonitoring(
        dataOf(
          monitoringResponse,
        ),
      );

      setScheduler(
        dataOf(
          schedulerResponse,
        ),
      );

      const incidentData =
        dataOf(
          incidentsResponse,
        );

      setIncidents(
        Array.isArray(
          incidentData,
        )
          ? incidentData
          : Array.isArray(
                incidentData?.items,
              )
            ? incidentData.items
            : [],
      );
    } catch (
      error: any
    ) {
      showToast(
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runScan =
    async () => {
      try {
        setOperating(true);

        const response =
          await AdminFinanceApi.runReconciliationScan(
            100,
          );

        const result =
          dataOf(response);

        showToast(
          `Reconciliação executada. ${
            result?.scanned ??
            result?.processed ??
            0
          } item(ns) analisado(s).`,
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(false);
      }
    };

  const runScheduler =
    async () => {
      try {
        setOperating(true);

        await AdminFinanceApi.runReconciliationSchedulerOnce();

        showToast(
          'Ciclo manual do scheduler financeiro executado.',
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(false);
      }
    };

  const acknowledge =
    async (
      incident: any,
    ) => {
      try {
        await AdminFinanceApi.acknowledgeIncident(
          incident.id,
        );

        showToast(
          'Incidente reconhecido.',
        );

        setSelectedIncident(
          null,
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      }
    };

  const resolve =
    async (
      incident: any,
    ) => {
      const note =
        window
          .prompt(
            'Informe a nota de resolução:',
          )
          ?.trim();

      if (note === undefined) {
        return;
      }

      try {
        await AdminFinanceApi.resolveIncident(
          incident.id,
          note,
        );

        showToast(
          'Incidente financeiro resolvido.',
        );

        setSelectedIncident(
          null,
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      }
    };

  const recheck =
    async (
      incident: any,
    ) => {
      try {
        await AdminFinanceApi.executeIncidentRecovery(
          incident.id,
          'RECHECK',
          'Rechecagem solicitada pelo painel administrativo.',
        );

        showToast(
          'Rechecagem do incidente executada.',
        );

        setSelectedIncident(
          null,
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      }
    };

  if (loading) {
    return (
      <div className="bg-white border rounded-2xl min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
      </div>
    );
  }

  const ready =
    readiness?.ready ??
    readiness?.status ===
      'ready' ??
    false;

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />

            Visão Financeira
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Reconciliação financeira,
            incidentes, readiness e
            scheduler operacional reais.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="px-4 py-2.5 bg-gray-100 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            type="button"
            disabled={
              operating
            }
            onClick={() =>
              void runScan()
            }
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Executar scan
          </button>

          <button
            type="button"
            disabled={
              operating
            }
            onClick={() =>
              void runScheduler()
            }
            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black"
          >
            Rodar scheduler
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <Card
          label="Incidentes"
          value={
            summary?.total ??
            0
          }
        />

        <Card
          label="Abertos"
          value={
            summary?.open ??
            0
          }
        />

        <Card
          label="Reconhecidos"
          value={
            summary?.acknowledged ??
            0
          }
        />

        <Card
          label="Resolvidos"
          value={
            summary?.resolved ??
            0
          }
        />

        <Card
          label="Warnings"
          value={
            summary?.warning ??
            0
          }
        />

        <Card
          label="Críticos"
          value={
            summary?.critical ??
            0
          }
        />
      </div>

      <div
        className={`border rounded-2xl p-5 ${
          ready
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}
      >
        <div className="flex gap-3">
          {ready ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          )}

          <div>
            <h3 className="font-black">
              Readiness financeiro:{' '}
              {ready
                ? 'SAUDÁVEL'
                : 'ATENÇÃO'}
            </h3>

            <p className="text-xs mt-1 text-gray-600">
              Banco, scheduler,
              reconciliação e incidentes
              críticos são avaliados pelo
              backend.
            </p>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="bg-white border rounded-2xl p-5">
          <h3 className="font-black flex gap-2">
            <Clock3 className="w-5 h-5 text-purple-600" />
            Scheduler
          </h3>

          <div className="mt-4 space-y-2 text-xs">
            <Info
              label="Habilitado"
              value={
                scheduler?.enabled
                  ? 'Sim'
                  : 'Não'
              }
            />

            <Info
              label="Executando"
              value={
                scheduler?.running
                  ? 'Sim'
                  : 'Não'
              }
            />

            <Info
              label="Execuções"
              value={
                scheduler?.totalRuns ??
                0
              }
            />

            <Info
              label="Falhas consecutivas"
              value={
                scheduler?.consecutiveFailures ??
                0
              }
            />

            <Info
              label="Último sucesso"
              value={date(
                scheduler?.lastSuccessAt,
              )}
            />

            <Info
              label="Último erro"
              value={
                scheduler?.lastError ||
                '—'
              }
            />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <h3 className="font-black">
            Monitoramento
          </h3>

          <pre className="mt-4 bg-slate-950 text-slate-100 rounded-xl p-4 text-[10px] overflow-x-auto max-h-64">
            {JSON.stringify(
              monitoring,
              null,
              2,
            )}
          </pre>
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-black flex items-center gap-2">
            <Siren className="w-5 h-5 text-red-600" />
            Incidentes de Reconciliação
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            Divergências persistidas pelo
            backend financeiro.
          </p>
        </div>

        {!incidents.length ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhum incidente financeiro.
          </div>
        ) : (
          <div className="divide-y">
            {incidents.map(
              (
                incident,
              ) => (
                <button
                  key={
                    incident.id
                  }
                  type="button"
                  onClick={() =>
                    setSelectedIncident(
                      incident,
                    )
                  }
                  className="w-full p-4 text-left hover:bg-gray-50 grid md:grid-cols-4 gap-3 text-xs"
                >
                  <div>
                    <span className="block text-[9px] text-gray-400">
                      Código
                    </span>

                    <strong>
                      {incident.code ||
                        incident.issueCode ||
                        incident.id}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[9px] text-gray-400">
                      Severidade
                    </span>

                    <strong>
                      {incident.severity ||
                        '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[9px] text-gray-400">
                      Status
                    </span>

                    <strong>
                      {incident.status ||
                        '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="block text-[9px] text-gray-400">
                      Atualizado
                    </span>

                    <strong>
                      {date(
                        incident.updatedAt ||
                          incident.createdAt,
                      )}
                    </strong>
                  </div>
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between border-b pb-3">
              <div>
                <h3 className="font-black">
                  Incidente Financeiro
                </h3>

                <p className="text-[10px] text-gray-500 font-mono">
                  {
                    selectedIncident.id
                  }
                </p>
              </div>

              <button
                onClick={() =>
                  setSelectedIncident(
                    null,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="mt-4 bg-slate-950 text-slate-100 rounded-xl p-4 text-[10px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(
                selectedIncident,
                null,
                2,
              )}
            </pre>

            <div className="border-t mt-4 pt-4 flex flex-wrap justify-end gap-2">
              {selectedIncident.status ===
                'OPEN' && (
                <button
                  onClick={() =>
                    void acknowledge(
                      selectedIncident,
                    )
                  }
                  className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold"
                >
                  Reconhecer
                </button>
              )}

              <button
                onClick={() =>
                  void recheck(
                    selectedIncident,
                  )
                }
                className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold"
              >
                Rechecar
              </button>

              {selectedIncident.status !==
                'RESOLVED' && (
                <button
                  onClick={() =>
                    void resolve(
                      selectedIncident,
                    )
                  }
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                >
                  Resolver
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Card: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="bg-white border rounded-2xl p-5">
    <div className="text-[10px] uppercase font-black text-gray-400">
      {label}
    </div>

    <div className="text-3xl font-black mt-2">
      {value}
    </div>
  </div>
);

const Info: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="flex justify-between gap-4 border-b pb-2">
    <span className="text-gray-500">
      {label}
    </span>

    <strong className="text-right">
      {value}
    </strong>
  </div>
);