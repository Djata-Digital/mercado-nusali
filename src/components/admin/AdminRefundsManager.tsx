import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';

import { AdminFinanceApi } from '../../api/clients/AdminFinanceApi';

interface AdminRefundsManagerProps {
  showToast: (msg: string) => void;
}

interface RefundRow {
  refundId: string;
  paymentId?: string;
  orderId?: string;
  buyerId?: string;
  amount?: string;
  currency?: string;
  status?: string;
  reason?: string | null;
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
  processedAt?: string | null;
}

const getData = (response: any) =>
  response?.data?.data ??
  response?.data ??
  null;

const getErrorMessage = (
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
    ).format(new Date(value));
  } catch {
    return String(value);
  }
};

const formatMoney = (
  amount?: string,
  currency?: string,
) => {
  if (!amount) {
    return '—';
  }

  const numeric =
    Number(amount);

  if (
    Number.isFinite(numeric) &&
    currency
  ) {
    try {
      return new Intl.NumberFormat(
        'pt-BR',
        {
          style: 'currency',
          currency,
        },
      ).format(numeric);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  return `${amount}${
    currency ? ` ${currency}` : ''
  }`;
};

const statusClasses = (
  status?: string,
) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700';

    case 'PROCESSING':
      return 'bg-blue-100 text-blue-700';

    case 'FAILED':
      return 'bg-red-100 text-red-700';

    case 'PENDING':
      return 'bg-amber-100 text-amber-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const AdminRefundsManager:
React.FC<
  AdminRefundsManagerProps
> = ({
  showToast,
}) => {
  const [
    summary,
    setSummary,
  ] = useState<any>(null);

  const [
    metrics,
    setMetrics,
  ] = useState<any>(null);

  const [
    alerts,
    setAlerts,
  ] = useState<any>(null);

  const [
    issues,
    setIssues,
  ] = useState<any>(null);

  const [
    refunds,
    setRefunds,
  ] = useState<RefundRow[]>(
    [],
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
    statusFilter,
    setStatusFilter,
  ] = useState('');

  const [
    selectedRefund,
    setSelectedRefund,
  ] = useState<any>(null);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const [
        summaryResponse,
        reportResponse,
        issuesResponse,
        metricsResponse,
        alertsResponse,
      ] = await Promise.all([
        AdminFinanceApi.refundSummary(),

        AdminFinanceApi.refundReport({
          limit: 500,
        }),

        AdminFinanceApi.refundIssues(
          100,
        ),

        AdminFinanceApi.refundMetrics(),

        AdminFinanceApi.refundAlerts(),
      ]);

      const summaryData =
        getData(summaryResponse);

      const reportData =
        getData(reportResponse);

      const issuesData =
        getData(issuesResponse);

      const metricsData =
        getData(metricsResponse);

      const alertsData =
        getData(alertsResponse);

      setSummary(summaryData);
      setIssues(issuesData);
      setMetrics(metricsData);
      setAlerts(alertsData);

      setRefunds(
        Array.isArray(
          reportData?.rows,
        )
          ? reportData.rows
          : [],
      );
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRefunds =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return refunds.filter(
        (refund) => {
          if (
            statusFilter &&
            refund.status !==
              statusFilter
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          return [
            refund.refundId,
            refund.orderId,
            refund.paymentId,
            refund.buyerId,
            refund.reason,
            refund.provider,
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(term),
          );
        },
      );
    }, [
      refunds,
      search,
      statusFilter,
    ]);

  const inspectRefund =
    async (
      refundId: string,
    ) => {
      try {
        setDetailLoading(
          true,
        );

        const response =
          await AdminFinanceApi.refundInspect(
            refundId,
          );

        setSelectedRefund(
          getData(response),
        );
      } catch (error: any) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setDetailLoading(
          false,
        );
      }
    };

  const reconcileOne =
    async (
      refundId: string,
    ) => {
      const confirmed =
        window.confirm(
          'Executar reconciliação administrativa deste refund?',
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          refundId,
        );

        await AdminFinanceApi.refundReconcile(
          refundId,
        );

        showToast(
          'Reconciliação do refund executada.',
        );

        await load();
      } catch (error: any) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const reconcileStale =
    async () => {
      const confirmed =
        window.confirm(
          'Executar reconciliação dos refunds PROCESSING antigos?',
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          '__stale__',
        );

        const response =
          await AdminFinanceApi.refundReconcileStale(
            50,
          );

        const result =
          getData(response);

        showToast(
          `Reconciliação concluída. ${
            result?.scanned ?? 0
          } analisado(s), ${
            result?.completed ?? 0
          } concluído(s), ${
            result?.failed ?? 0
          } falha(s).`,
        );

        await load();
      } catch (error: any) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const refundSummary =
    summary?.refunds || {};

  const operationalAlerts =
    Array.isArray(
      alerts?.alerts,
    )
      ? alerts.alerts
      : [];

  const issueRefundIds =
    new Set<string>(
      Array.isArray(
        issues?.refunds,
      )
        ? issues.refunds.map(
            (item: any) =>
              item.id,
          )
        : [],
    );

  if (loading) {
    return (
      <div className="bg-white border rounded-2xl min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <ArrowDownRight className="w-6 h-6 text-purple-600" />

            Reembolsos
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Operação real de refunds,
            reconciliação, SLA,
            webhooks e auditoria
            financeira.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            type="button"
            disabled={
              operating ===
              '__stale__'
            }
            onClick={() =>
              void reconcileStale()
            }
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50"
          >
            {operating ===
            '__stale__' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}

            Reconciliar antigos
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Pendentes"
          value={
            refundSummary.pending ??
            0
          }
          icon={
            <Clock3 className="w-5 h-5" />
          }
        />

        <MetricCard
          title="Processando"
          value={
            refundSummary.processing ??
            0
          }
          icon={
            <RefreshCw className="w-5 h-5" />
          }
        />

        <MetricCard
          title="Concluídos"
          value={
            refundSummary.completed ??
            0
          }
          icon={
            <CheckCircle2 className="w-5 h-5" />
          }
        />

        <MetricCard
          title="Falhas"
          value={
            refundSummary.failed ??
            0
          }
          icon={
            <XCircle className="w-5 h-5" />
          }
        />

        <MetricCard
          title="PROCESSING fora do SLA"
          value={
            refundSummary.staleProcessing ??
            0
          }
          icon={
            <AlertTriangle className="w-5 h-5" />
          }
        />
      </div>

      {operationalAlerts.length >
        0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-black text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas operacionais
          </h3>

          <div className="mt-3 space-y-2">
            {operationalAlerts.map(
              (
                alert: any,
                index: number,
              ) => (
                <div
                  key={`${alert.code}-${index}`}
                  className="bg-white/70 border border-amber-200 rounded-xl p-3 text-xs"
                >
                  <div className="font-black">
                    {alert.code}
                  </div>

                  <div className="text-gray-700 mt-1">
                    {
                      alert.message
                    }
                  </div>

                  <div className="text-[10px] text-gray-500 mt-1">
                    Valor:{' '}
                    {alert.value} •
                    Limite:{' '}
                    {
                      alert.threshold
                    }{' '}
                    • Severidade:{' '}
                    {
                      alert.severity
                    }
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="ID do refund, pedido, pagamento, comprador..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos os status
          </option>

          <option value="PENDING">
            PENDING
          </option>

          <option value="PROCESSING">
            PROCESSING
          </option>

          <option value="COMPLETED">
            COMPLETED
          </option>

          <option value="FAILED">
            FAILED
          </option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-black">
              Histórico real de refunds
            </h2>

            <p className="text-[10px] text-gray-500 mt-1">
              {refunds.length}{' '}
              registro(s) carregados do
              backend.
            </p>
          </div>

          <div className="text-xs font-bold text-gray-500">
            Issues:{' '}
            {
              issueRefundIds.size
            }
          </div>
        </div>

        {!filteredRefunds.length ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhum refund encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Refund
                  </th>

                  <th className="p-3">
                    Pedido
                  </th>

                  <th className="p-3">
                    Valor
                  </th>

                  <th className="p-3">
                    Provider
                  </th>

                  <th className="p-3">
                    Status
                  </th>

                  <th className="p-3">
                    Criado
                  </th>

                  <th className="p-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredRefunds.map(
                  (refund) => {
                    const hasIssue =
                      issueRefundIds.has(
                        refund.refundId,
                      );

                    return (
                      <tr
                        key={
                          refund.refundId
                        }
                        className={
                          hasIssue
                            ? 'bg-amber-50/40'
                            : 'hover:bg-gray-50/60'
                        }
                      >
                        <td className="p-3">
                          <strong className="block font-mono">
                            {refund.refundId}
                          </strong>

                          <span className="text-[9px] text-gray-400">
                            {refund.paymentId ||
                              '—'}
                          </span>
                        </td>

                        <td className="p-3">
                          {refund.orderId ||
                            '—'}
                        </td>

                        <td className="p-3 font-black">
                          {formatMoney(
                            refund.amount,
                            refund.currency,
                          )}
                        </td>

                        <td className="p-3 font-bold">
                          {refund.provider ||
                            '—'}
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-[9px] font-black ${statusClasses(
                              refund.status,
                            )}`}
                          >
                            {refund.status ||
                              '—'}
                          </span>

                          {hasIssue && (
                            <div className="text-[9px] font-bold text-amber-700 mt-1">
                              Requer atenção
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          {formatDate(
                            refund.createdAt,
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="Inspecionar"
                              disabled={
                                detailLoading
                              }
                              onClick={() =>
                                void inspectRefund(
                                  refund.refundId,
                                )
                              }
                              className="p-2 text-purple-700 hover:bg-purple-50 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {hasIssue && (
                              <button
                                type="button"
                                title="Reconciliar"
                                disabled={
                                  operating ===
                                  refund.refundId
                                }
                                onClick={() =>
                                  void reconcileOne(
                                    refund.refundId,
                                  )
                                }
                                className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
                              >
                                {operating ===
                                refund.refundId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRefund && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-lg">
                  Inspeção do refund
                </h3>

                <p className="text-[10px] text-gray-500">
                  Estado real de
                  reconciliação e provider.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRefund(
                    null,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="mt-4 p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(
                selectedRefund,
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard:
React.FC<{
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}> = ({
  title,
  value,
  icon,
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <div className="flex items-center justify-between text-gray-400">
      <span className="text-[10px] font-black uppercase">
        {title}
      </span>

      {icon}
    </div>

    <div className="text-3xl font-black text-gray-900 mt-3">
      {value}
    </div>
  </div>
);