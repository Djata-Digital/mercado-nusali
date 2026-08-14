import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';

import {
  AdminRiskApi,
  RiskAlertStatus,
  RiskAlertType,
  RiskEntityType,
  RiskSeverity,
} from '../../api/clients/AdminRiskApi';

interface AdminRiskCenterProps {
  showToast: (
    msg: string,
  ) => void;
}

const dataOf = (
  response: any,
) =>
  response?.data?.data ??
  response?.data ??
  null;

const itemsOf = (
  response: any,
): any[] => {
  const data =
    dataOf(response);

  if (
    Array.isArray(data)
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.items,
    )
  ) {
    return data.items;
  }

  return [];
};

const errorMessage = (
  error: any,
) =>
  error?.response?.data?.error
    ?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const formatDate = (
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

const statusLabels:
Record<
  string,
  string
> = {
  OPEN:
    'Aberto',

  INVESTIGATING:
    'Em investigação',

  BLOCKED:
    'Bloqueado',

  RELEASED:
    'Liberado',

  MONITORING:
    'Monitorado',

  RESOLVED:
    'Resolvido',

  FALSE_POSITIVE:
    'Falso positivo',
};

const severityLabels:
Record<
  string,
  string
> = {
  LOW:
    'Baixo',

  MEDIUM:
    'Médio',

  HIGH:
    'Alto',

  CRITICAL:
    'Crítico',
};

const typeLabels:
Record<
  string,
  string
> = {
  SUSPICIOUS_PAYMENT:
    'Pagamento suspeito',

  MULTIPLE_ACCOUNTS:
    'Múltiplas contas',

  DOCUMENT_INCONSISTENCY:
    'Documentos inconsistentes',

  HIGH_RISK_PAYOUT:
    'Payout de alto risco',

  NEW_SELLER_HIGH_VOLUME:
    'Vendedor novo com alto volume',

  CHARGEBACK:
    'Chargeback',

  SUSPICIOUS_ADDRESS:
    'Endereço suspeito',

  LOGISTICS_FRAUD:
    'Fraude logística',

  COUNTERFEIT_SUSPECTED:
    'Suspeita de falsificação',

  PAYOUT_RECONCILIATION:
    'Inconsistência de payout',

  ACCOUNT_TAKEOVER:
    'Possível tomada de conta',

  OTHER:
    'Outro',
};

const entityLabels:
Record<
  string,
  string
> = {
  USER:
    'Usuário',

  SELLER:
    'Vendedor',

  STORE:
    'Loja',

  ORDER:
    'Pedido',

  PAYMENT:
    'Pagamento',

  PAYOUT:
    'Payout',

  PRODUCT:
    'Produto',

  SHIPMENT:
    'Envio',
};

const statusBadge = (
  status?: string,
) => {
  switch (status) {
    case 'OPEN':
      return 'bg-red-100 text-red-700';

    case 'INVESTIGATING':
      return 'bg-blue-100 text-blue-700';

    case 'BLOCKED':
      return 'bg-red-600 text-white';

    case 'MONITORING':
      return 'bg-amber-100 text-amber-700';

    case 'RELEASED':
      return 'bg-cyan-100 text-cyan-700';

    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-700';

    case 'FALSE_POSITIVE':
      return 'bg-gray-200 text-gray-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const severityBadge = (
  severity?: string,
) => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-600 text-white';

    case 'HIGH':
      return 'bg-orange-100 text-orange-700';

    case 'MEDIUM':
      return 'bg-amber-100 text-amber-700';

    case 'LOW':
      return 'bg-emerald-100 text-emerald-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const AdminRiskCenter:
React.FC<
  AdminRiskCenterProps
> = ({
  showToast,
}) => {
  const [
    alerts,
    setAlerts,
  ] = useState<any[]>(
    [],
  );

  const [
    selected,
    setSelected,
  ] = useState<any>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    operating,
    setOperating,
  ] = useState<
    string | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    status,
    setStatus,
  ] = useState<
    '' | RiskAlertStatus
  >('');

  const [
    severity,
    setSeverity,
  ] = useState<
    '' | RiskSeverity
  >('');

  const [
    type,
    setType,
  ] = useState<
    '' | RiskAlertType
  >('');

  const [
    entityType,
    setEntityType,
  ] = useState<
    '' | RiskEntityType
  >('');

  const load =
    async () => {
      try {
        setLoading(
          true,
        );

        const response =
          await AdminRiskApi.list(
            {
              page: 1,
              limit: 200,

              ...(status
                ? {
                    status,
                  }
                : {}),

              ...(severity
                ? {
                    severity,
                  }
                : {}),

              ...(type
                ? {
                    type,
                  }
                : {}),

              ...(entityType
                ? {
                    entityType,
                  }
                : {}),
            },
          );

        setAlerts(
          itemsOf(
            response,
          ),
        );
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(
            error,
          ),
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  useEffect(() => {
    void load();
  }, [
    status,
    severity,
    type,
    entityType,
  ]);

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return alerts;
      }

      return alerts.filter(
        (alert) =>
          [
            alert.id,
            alert.title,
            alert.description,
            alert.ruleCode,
            alert.country,
            alert.entityId,
            typeLabels[
              alert.type
            ],
            entityLabels[
              alert.entityType
            ],
          ].some(
            (value) =>
              String(
                value ||
                  '',
              )
                .toLowerCase()
                .includes(
                  term,
                ),
          ),
      );
    }, [
      alerts,
      search,
    ]);

  const counts =
    useMemo(
      () => ({
        total:
          alerts.length,

        open:
          alerts.filter(
            (a) =>
              a.status ===
              'OPEN',
          ).length,

        investigating:
          alerts.filter(
            (a) =>
              a.status ===
              'INVESTIGATING',
          ).length,

        critical:
          alerts.filter(
            (a) =>
              a.severity ===
              'CRITICAL',
          ).length,

        monitoring:
          alerts.filter(
            (a) =>
              a.status ===
              'MONITORING',
          ).length,
      }),
      [alerts],
    );

  const refreshSelected =
    async (
      id: string,
    ) => {
      const response =
        await AdminRiskApi.get(
          id,
        );

      setSelected(
        dataOf(
          response,
        ),
      );
    };

  const run =
    async (
      key: string,
      action: () =>
        Promise<any>,
      message: string,
      id?: string,
    ) => {
      try {
        setOperating(
          key,
        );

        await action();

        showToast(
          message,
        );

        await load();

        if (id) {
          await refreshSelected(
            id,
          );
        }
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(
            error,
          ),
        );
      } finally {
        setOperating(
          null,
        );
      }
    };

  const changeStatus =
    async (
      alert: any,
      nextStatus:
        RiskAlertStatus,
    ) => {
      const note =
        window
          .prompt(
            `Observação para alterar para "${statusLabels[nextStatus]}":`,
          )
          ?.trim();

      if (
        note === undefined
      ) {
        return;
      }

      await run(
        `status-${nextStatus}`,

        () =>
          AdminRiskApi.updateStatus(
            alert.id,
            {
              status:
                nextStatus,

              note:
                note ||
                undefined,
            },
          ),

        `Alerta alterado para ${statusLabels[nextStatus]}.`,

        alert.id,
      );
    };

  const resolve =
    async (
      alert: any,
      finalStatus:
        | 'RESOLVED'
        | 'FALSE_POSITIVE',
    ) => {
      const resolution =
        window
          .prompt(
            finalStatus ===
              'RESOLVED'
              ? 'Informe a conclusão da investigação:'
              : 'Explique por que este alerta é falso positivo:',
          )
          ?.trim();

      if (!resolution) {
        return;
      }

      await run(
        `resolve-${finalStatus}`,

        () =>
          AdminRiskApi.resolve(
            alert.id,
            {
              status:
                finalStatus,

              resolution,
            },
          ),

        finalStatus ===
          'RESOLVED'
          ? 'Alerta resolvido.'
          : 'Alerta marcado como falso positivo.',

        alert.id,
      );
    };

  if (
    loading &&
    !alerts.length
  ) {
    return (
      <div className="bg-white border rounded-2xl min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-600" />

            Central de Risco, Antifraude & Prevenção de Perdas
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Alertas reais gerados por regras de risco, reconciliação financeira e comportamento suspeito.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          disabled={
            loading
          }
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              loading
                ? 'animate-spin'
                : ''
            }`}
          />

          Atualizar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Metric
          label="Total"
          value={
            counts.total
          }
        />

        <Metric
          label="Abertos"
          value={
            counts.open
          }
        />

        <Metric
          label="Em investigação"
          value={
            counts.investigating
          }
        />

        <Metric
          label="Críticos"
          value={
            counts.critical
          }
        />

        <Metric
          label="Monitorados"
          value={
            counts.monitoring
          }
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid xl:grid-cols-[1fr_auto_auto_auto_auto] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          <input
            value={
              search
            }
            onChange={(
              event,
            ) =>
              setSearch(
                event.target
                  .value,
              )
            }
            placeholder="Buscar alerta, regra, entidade ou país..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs"
          />
        </div>

        <select
          value={
            status
          }
          onChange={(
            event,
          ) =>
            setStatus(
              event.target
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos status
          </option>

          {Object.entries(
            statusLabels,
          ).map(
            ([
              value,
              label,
            ]) => (
              <option
                key={
                  value
                }
                value={
                  value
                }
              >
                {label}
              </option>
            ),
          )}
        </select>

        <select
          value={
            severity
          }
          onChange={(
            event,
          ) =>
            setSeverity(
              event.target
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todas severidades
          </option>

          {Object.entries(
            severityLabels,
          ).map(
            ([
              value,
              label,
            ]) => (
              <option
                key={
                  value
                }
                value={
                  value
                }
              >
                {label}
              </option>
            ),
          )}
        </select>

        <select
          value={
            type
          }
          onChange={(
            event,
          ) =>
            setType(
              event.target
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos tipos
          </option>

          {Object.entries(
            typeLabels,
          ).map(
            ([
              value,
              label,
            ]) => (
              <option
                key={
                  value
                }
                value={
                  value
                }
              >
                {label}
              </option>
            ),
          )}
        </select>

        <select
          value={
            entityType
          }
          onChange={(
            event,
          ) =>
            setEntityType(
              event.target
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todas entidades
          </option>

          {Object.entries(
            entityLabels,
          ).map(
            ([
              value,
              label,
            ]) => (
              <option
                key={
                  value
                }
                value={
                  value
                }
              >
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {!filtered.length ? (
        <div className="bg-white border rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />

          <h3 className="font-black mt-3">
            Nenhum alerta de risco
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Quando o motor detectar uma situação suspeita, o alerta aparecerá aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Alerta
                  </th>

                  <th className="p-3">
                    Risco
                  </th>

                  <th className="p-3">
                    Tipo
                  </th>

                  <th className="p-3">
                    Entidade
                  </th>

                  <th className="p-3">
                    Regra
                  </th>

                  <th className="p-3">
                    Status
                  </th>

                  <th className="p-3">
                    Detectado
                  </th>

                  <th className="p-3 text-right">
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map(
                  (alert) => (
                    <tr
                      key={
                        alert.id
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <strong>
                          {alert.title}
                        </strong>

                        <div className="text-[9px] text-gray-400 font-mono mt-1">
                          {alert.id}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-[9px] font-black ${severityBadge(
                              alert.severity,
                            )}`}
                          >
                            {severityLabels[
                              alert.severity
                            ] ||
                              alert.severity}
                          </span>

                          <strong>
                            {alert.riskScore}%
                          </strong>
                        </div>
                      </td>

                      <td className="p-3">
                        {typeLabels[
                          alert.type
                        ] ||
                          alert.type}
                      </td>

                      <td className="p-3">
                        <strong>
                          {entityLabels[
                            alert.entityType
                          ] ||
                            alert.entityType}
                        </strong>

                        <div className="text-[9px] text-gray-400">
                          {alert.entityId ||
                            '—'}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[10px]">
                        {alert.ruleCode ||
                          '—'}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black ${statusBadge(
                            alert.status,
                          )}`}
                        >
                          {statusLabels[
                            alert.status
                          ] ||
                            alert.status}
                        </span>
                      </td>

                      <td className="p-3">
                        {formatDate(
                          alert.detectedAt,
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void refreshSelected(
                              alert.id,
                            )
                          }
                          className="p-2 text-purple-700 hover:bg-purple-50 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-50 w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl">
            <div className="sticky top-0 bg-white border-b rounded-t-3xl p-5 flex items-center justify-between z-10">
              <div>
                <span className="text-[10px] text-purple-700 font-mono font-bold">
                  {selected.alert?.id ||
                    selected.id}
                </span>

                <h2 className="text-xl font-black">
                  {selected.alert?.title ||
                    selected.title}
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelected(
                    null,
                  )
                }
                className="p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const alert =
                selected.alert ||
                selected;

              const history =
                selected.history ||
                alert.history ||
                [];

              const relatedEntity =
                selected.relatedEntity;

              return (
                <div className="p-5 space-y-5">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <Info
                      label="Score"
                      value={`${alert.riskScore}%`}
                    />

                    <Info
                      label="Severidade"
                      value={
                        severityLabels[
                          alert.severity
                        ] ||
                        alert.severity
                      }
                    />

                    <Info
                      label="Status"
                      value={
                        statusLabels[
                          alert.status
                        ] ||
                        alert.status
                      }
                    />

                    <Info
                      label="Entidade"
                      value={
                        entityLabels[
                          alert.entityType
                        ] ||
                        alert.entityType
                      }
                    />

                    <Info
                      label="País"
                      value={
                        alert.country ||
                        '—'
                      }
                    />
                  </div>

                  <div className="bg-white border rounded-2xl p-5">
                    <h3 className="font-black text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />

                      Motivo do alerta
                    </h3>

                    <p className="text-xs text-gray-700 mt-3 whitespace-pre-wrap">
                      {alert.description}
                    </p>

                    <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <strong>
                          Tipo:
                        </strong>{' '}
                        {typeLabels[
                          alert.type
                        ] ||
                          alert.type}
                      </div>

                      <div>
                        <strong>
                          Regra:
                        </strong>{' '}
                        <span className="font-mono">
                          {alert.ruleCode ||
                            '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {relatedEntity && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                      <h3 className="font-black text-sm">
                        Entidade relacionada
                      </h3>

                      <pre className="text-[10px] mt-3 whitespace-pre-wrap break-words overflow-x-auto">
                        {JSON.stringify(
                          relatedEntity,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}

                  {alert.metadata && (
                    <div className="bg-white border rounded-2xl p-5">
                      <h3 className="font-black text-sm">
                        Dados da detecção
                      </h3>

                      <pre className="text-[10px] mt-3 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap break-words overflow-x-auto">
                        {JSON.stringify(
                          alert.metadata,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}

                  <div className="bg-white border rounded-2xl p-5">
                    <h3 className="font-black text-sm">
                      Ações de investigação
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {alert.status !==
                        'INVESTIGATING' && (
                        <button
                          type="button"
                          onClick={() =>
                            void changeStatus(
                              alert,
                              'INVESTIGATING',
                            )
                          }
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black"
                        >
                          Iniciar investigação
                        </button>
                      )}

                      {alert.status !==
                        'MONITORING' && (
                        <button
                          type="button"
                          onClick={() =>
                            void changeStatus(
                              alert,
                              'MONITORING',
                            )
                          }
                          className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-black"
                        >
                          Monitorar
                        </button>
                      )}

                      {alert.status !==
                        'BLOCKED' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                'Marcar este caso como bloqueado na Central de Risco? Isso NÃO congela Wallet nem altera Ledger.',
                              )
                            ) {
                              return;
                            }

                            void changeStatus(
                              alert,
                              'BLOCKED',
                            );
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black"
                        >
                          Marcar bloqueado
                        </button>
                      )}

                      {alert.status ===
                        'BLOCKED' && (
                        <button
                          type="button"
                          onClick={() =>
                            void changeStatus(
                              alert,
                              'RELEASED',
                            )
                          }
                          className="px-4 py-2 bg-cyan-50 text-cyan-700 rounded-xl text-xs font-black"
                        >
                          Liberar caso
                        </button>
                      )}

                      {![
                        'RESOLVED',
                        'FALSE_POSITIVE',
                      ].includes(
                        alert.status,
                      ) && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void resolve(
                                alert,
                                'RESOLVED',
                              )
                            }
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                          >
                            Resolver
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void resolve(
                                alert,
                                'FALSE_POSITIVE',
                              )
                            }
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-black"
                          >
                            Falso positivo
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border rounded-2xl p-5">
                    <h3 className="font-black text-sm">
                      Histórico
                    </h3>

                    {!history.length ? (
                      <p className="text-xs text-gray-500 mt-3">
                        Nenhum evento de histórico.
                      </p>
                    ) : (
                      <div className="mt-4 border-l-2 border-purple-200 pl-4 space-y-4">
                        {history.map(
                          (
                            entry: any,
                          ) => (
                            <div
                              key={
                                entry.id
                              }
                            >
                              <div className="text-xs font-black">
                                {entry.action ||
                                  statusLabels[
                                    entry.newStatus
                                  ] ||
                                  entry.newStatus ||
                                  'Evento'}
                              </div>

                              <p className="text-[10px] text-gray-600 mt-1">
                                {entry.note ||
                                  '—'}
                              </p>

                              <span className="text-[9px] text-gray-400">
                                {formatDate(
                                  entry.createdAt,
                                )}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {alert.assignedTo && (
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-purple-700" />

                      <div>
                        <div className="text-[10px] font-black uppercase text-purple-700">
                          Responsável
                        </div>

                        <div className="text-xs font-bold mt-1">
                          {`${alert.assignedTo.firstName || ''} ${alert.assignedTo.lastName || ''}`.trim() ||
                            alert.assignedTo.email}
                        </div>
                      </div>
                    </div>
                  )}

                  {alert.status ===
                    'RESOLVED' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />

                      <div>
                        <strong className="text-xs">
                          Investigação concluída
                        </strong>

                        <p className="text-xs mt-1">
                          {alert.resolution ||
                            'Caso resolvido.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {alert.status ===
                    'FALSE_POSITIVE' && (
                    <div className="bg-gray-100 border rounded-2xl p-4 flex gap-3">
                      <XCircle className="w-5 h-5 text-gray-600" />

                      <div>
                        <strong className="text-xs">
                          Falso positivo
                        </strong>

                        <p className="text-xs mt-1">
                          {alert.resolution ||
                            'Alerta encerrado como falso positivo.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const Metric:
React.FC<{
  label: string;
  value:
    React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="bg-white border rounded-2xl p-5">
    <div className="text-[9px] uppercase font-black text-gray-400">
      {label}
    </div>

    <div className="text-3xl font-black mt-2">
      {value}
    </div>
  </div>
);

const Info:
React.FC<{
  label: string;
  value:
    React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="bg-white border rounded-2xl p-4">
    <div className="text-[9px] uppercase font-black text-gray-400">
      {label}
    </div>

    <div className="text-xs font-black mt-2 break-words">
      {value}
    </div>
  </div>
);