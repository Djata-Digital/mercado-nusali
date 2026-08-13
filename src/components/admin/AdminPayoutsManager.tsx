import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react';

import { AdminFinanceApi } from '../../api/clients/AdminFinanceApi';

interface AdminPayoutsManagerProps {
  showToast: (msg: string) => void;
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
  amount: any,
  currency?: any,
) => {
  const code =
    typeof currency ===
    'string'
      ? currency
      : currency?.code;

  const numeric =
    Number(amount);

  if (
    Number.isFinite(numeric) &&
    code
  ) {
    try {
      return new Intl.NumberFormat(
        'pt-BR',
        {
          style: 'currency',
          currency: code,
        },
      ).format(numeric);
    } catch {
      return `${amount} ${code}`;
    }
  }

  return `${amount ?? '—'}${
    code ? ` ${code}` : ''
  }`;
};

const statusClasses = (
  status?: string,
) => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700';

    case 'PROCESSING':
      return 'bg-blue-100 text-blue-700';

    case 'CREATED':
      return 'bg-amber-100 text-amber-700';

    case 'FAILED':
      return 'bg-red-100 text-red-700';

    case 'CANCELLED':
      return 'bg-gray-200 text-gray-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const AdminPayoutsManager:
React.FC<
  AdminPayoutsManagerProps
> = ({
  showToast,
}) => {
  const [
    payouts,
    setPayouts,
  ] = useState<any[]>([]);

  const [
    issues,
    setIssues,
  ] = useState<any[]>([]);

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
    reconciliation,
    setReconciliation,
  ] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);

      const [
        payoutsResponse,
        issuesResponse,
      ] = await Promise.all([
        AdminFinanceApi.listPayouts({
          limit: 200,
        }),

        AdminFinanceApi.payoutReconciliationIssues(
          100,
        ),
      ]);

      const payoutData =
        getData(
          payoutsResponse,
        );

      const issueData =
        getData(
          issuesResponse,
        );

      setPayouts(
        Array.isArray(payoutData)
          ? payoutData
          : [],
      );

      setIssues(
        Array.isArray(issueData)
          ? issueData
          : Array.isArray(
                issueData?.items,
              )
            ? issueData.items
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

  const filteredPayouts =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return payouts.filter(
        (payout) => {
          if (
            statusFilter &&
            payout.status !==
              statusFilter
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          const sellerName =
            `${payout.seller?.user?.firstName || ''} ${
              payout.seller?.user?.lastName || ''
            }`;

          const storeName =
            payout.seller
              ?.stores?.[0]
              ?.name;

          return [
            payout.id,
            payout.sellerId,
            sellerName,
            storeName,
            payout.seller?.user
              ?.email,
            payout.payoutMethod,
            payout.status,
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(term),
          );
        },
      );
    }, [
      payouts,
      search,
      statusFilter,
    ]);

  const counts =
    useMemo(() => {
      return payouts.reduce(
        (
          acc: Record<
            string,
            number
          >,
          payout,
        ) => {
          const key =
            payout.status ||
            'UNKNOWN';

          acc[key] =
            (acc[key] || 0) +
            1;

          return acc;
        },
        {},
      );
    }, [payouts]);

  const processPayout =
    async (
      payoutId: string,
    ) => {
      const confirmed =
        window.confirm(
          'Processar este payout? Esta operação movimenta saldo financeiro.',
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          payoutId,
        );

        await AdminFinanceApi.processPayout(
          payoutId,
        );

        showToast(
          'Payout processado com sucesso.',
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

  const failPayout =
    async (
      payoutId: string,
    ) => {
      const reason =
        window
          .prompt(
            'Informe o motivo da falha do payout:',
          )
          ?.trim();

      if (!reason) {
        return;
      }

      try {
        setOperating(
          payoutId,
        );

        await AdminFinanceApi.failPayout(
          payoutId,
          reason,
        );

        showToast(
          'Payout marcado como falho e saldo reservado tratado pelo backend.',
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

  const reconcilePayout =
    async (
      payoutId: string,
    ) => {
      try {
        setOperating(
          payoutId,
        );

        const response =
          await AdminFinanceApi.reconcilePayout(
            payoutId,
          );

        setReconciliation({
          payoutId,
          data: getData(
            response,
          ),
        });
      } catch (error: any) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

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
            <ArrowUpRight className="w-6 h-6 text-purple-600" />

            Payouts
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Repasses reais para
            vendedores, processamento,
            falhas e reconciliação com
            Wallet/Ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Criados"
          value={
            counts.CREATED || 0
          }
        />

        <MetricCard
          title="Processando"
          value={
            counts.PROCESSING ||
            0
          }
        />

        <MetricCard
          title="Pagos"
          value={
            counts.PAID || 0
          }
        />

        <MetricCard
          title="Falhos"
          value={
            counts.FAILED || 0
          }
        />

        <MetricCard
          title="Inconsistências"
          value={
            issues.length
          }
        />
      </div>

      {issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />

            <div>
              <h3 className="font-black text-amber-900">
                Reconciliação requer
                atenção
              </h3>

              <p className="text-xs text-amber-800 mt-1">
                O backend detectou{' '}
                {issues.length}{' '}
                payout(s) com
                divergência entre payout,
                Wallet e/ou Ledger.
              </p>
            </div>
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
            placeholder="Payout, vendedor, loja, e-mail..."
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
            Todos
          </option>

          <option value="CREATED">
            CREATED
          </option>

          <option value="PROCESSING">
            PROCESSING
          </option>

          <option value="PAID">
            PAID
          </option>

          <option value="FAILED">
            FAILED
          </option>

          <option value="CANCELLED">
            CANCELLED
          </option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {!filteredPayouts.length ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhum payout encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Payout
                  </th>

                  <th className="p-3">
                    Vendedor
                  </th>

                  <th className="p-3">
                    Valor
                  </th>

                  <th className="p-3">
                    Método
                  </th>

                  <th className="p-3">
                    Status
                  </th>

                  <th className="p-3">
                    Data
                  </th>

                  <th className="p-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredPayouts.map(
                  (payout) => {
                    const user =
                      payout.seller
                        ?.user;

                    const sellerName =
                      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
                      payout.sellerId;

                    const store =
                      payout.seller
                        ?.stores?.[0];

                    return (
                      <tr
                        key={
                          payout.id
                        }
                        className="hover:bg-gray-50/60"
                      >
                        <td className="p-3">
                          <strong className="font-mono">
                            {
                              payout.id
                            }
                          </strong>
                        </td>

                        <td className="p-3">
                          <strong className="block">
                            {
                              sellerName
                            }
                          </strong>

                          <span className="text-[9px] text-gray-400">
                            {store?.name ||
                              user?.email ||
                              '—'}
                          </span>
                        </td>

                        <td className="p-3 font-black">
                          {formatMoney(
                            payout.amount,
                            payout.currency,
                          )}
                        </td>

                        <td className="p-3 font-bold">
                          {payout.payoutMethod ||
                            '—'}
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-[9px] font-black ${statusClasses(
                              payout.status,
                            )}`}
                          >
                            {
                              payout.status
                            }
                          </span>
                        </td>

                        <td className="p-3">
                          {formatDate(
                            payout.createdAt,
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="Reconciliar"
                              disabled={
                                operating ===
                                payout.id
                              }
                              onClick={() =>
                                void reconcilePayout(
                                  payout.id,
                                )
                              }
                              className="p-2 text-purple-700 hover:bg-purple-50 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {payout.status ===
                              'CREATED' && (
                              <button
                                type="button"
                                title="Processar payout"
                                disabled={
                                  operating ===
                                  payout.id
                                }
                                onClick={() =>
                                  void processPayout(
                                    payout.id,
                                  )
                                }
                                className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                              >
                                {operating ===
                                payout.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            {payout.status ===
                              'PROCESSING' && (
                              <button
                                type="button"
                                title="Marcar payout como falho"
                                disabled={
                                  operating ===
                                  payout.id
                                }
                                onClick={() =>
                                  void failPayout(
                                    payout.id,
                                  )
                                }
                                className="p-2 text-red-700 hover:bg-red-50 rounded-lg"
                              >
                                <XCircle className="w-4 h-4" />
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

      {reconciliation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-lg">
                  Reconciliação do payout
                </h3>

                <p className="text-[10px] text-gray-500 font-mono">
                  {
                    reconciliation.payoutId
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setReconciliation(
                    null,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="mt-4 p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(
                reconciliation.data,
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
}> = ({
  title,
  value,
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <span className="text-[10px] uppercase text-gray-400 font-black">
      {title}
    </span>

    <div className="text-3xl font-black mt-2">
      {value}
    </div>
  </div>
);