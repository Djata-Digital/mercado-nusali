import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Wallet,
  X,
} from 'lucide-react';

import { AdminFinanceApi } from '../../api/clients/AdminFinanceApi';
import { CurrenciesApi } from '../../api/clients/CurrenciesApi';

interface AdminSettlementsManagerProps {
  showToast: (message: string) => void;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol?: string;
}

const dataOf = (response: any) =>
  response?.data?.data ??
  response?.data ??
  null;

const arrayOf = <T,>(
  response: any,
): T[] => {
  const data = dataOf(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
};

const errorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
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
  currencyCode?: string,
) => {
  if (
    amount === null ||
    amount === undefined
  ) {
    return '—';
  }

  const numeric =
    Number(amount);

  if (
    Number.isFinite(numeric) &&
    currencyCode
  ) {
    try {
      return new Intl.NumberFormat(
        'pt-BR',
        {
          style: 'currency',
          currency: currencyCode,
        },
      ).format(numeric);
    } catch {
      return `${amount} ${currencyCode}`;
    }
  }

  return `${amount}${
    currencyCode
      ? ` ${currencyCode}`
      : ''
  }`;
};

const batchStatusClasses = (
  status?: string,
) => {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-700';

    case 'PROCESSING':
      return 'bg-amber-100 text-amber-700';

    case 'CLOSED':
      return 'bg-emerald-100 text-emerald-700';

    case 'FAILED':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const settlementStatusClasses = (
  status?: string,
) => {
  switch (status) {
    case 'READY':
      return 'bg-blue-100 text-blue-700';

    case 'PAYOUT_PENDING':
      return 'bg-amber-100 text-amber-700';

    case 'PROCESSING':
      return 'bg-purple-100 text-purple-700';

    case 'SETTLED':
      return 'bg-emerald-100 text-emerald-700';

    case 'FAILED':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const AdminSettlementsManager:
React.FC<
  AdminSettlementsManagerProps
> = ({
  showToast,
}) => {
  const [
    batches,
    setBatches,
  ] = useState<any[]>([]);

  const [
    currencies,
    setCurrencies,
  ] = useState<Currency[]>([]);

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
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    selectedBatch,
    setSelectedBatch,
  ] = useState<any>(null);

  const [
    batchDetailLoading,
    setBatchDetailLoading,
  ] = useState(false);

  const [
    selectedSettlement,
    setSelectedSettlement,
  ] = useState<any>(null);

  const [
    settlementEligibility,
    setSettlementEligibility,
  ] = useState<any>(null);

  const [
    settlementStatement,
    setSettlementStatement,
  ] = useState<any>(null);

  const [
    report,
    setReport,
  ] = useState<any>(null);

  const [
    finalization,
    setFinalization,
  ] = useState<any>(null);

  const [
    periodStart,
    setPeriodStart,
  ] = useState('');

  const [
    periodEnd,
    setPeriodEnd,
  ] = useState('');

  const [
    currencyId,
    setCurrencyId,
  ] = useState('');

  const load = async () => {
    try {
      setLoading(true);

      const [
        batchesResponse,
        currenciesResponse,
      ] = await Promise.all([
        AdminFinanceApi.listSettlementBatches(
          100,
        ),

        CurrenciesApi.list(),
      ]);

      const batchList =
        arrayOf<any>(
          batchesResponse,
        );

      const currencyList =
        arrayOf<Currency>(
          currenciesResponse,
        );

      setBatches(batchList);
      setCurrencies(currencyList);

      if (
        !currencyId &&
        currencyList.length
      ) {
        const xof =
          currencyList.find(
            (currency) =>
              currency.code ===
              'XOF',
          );

        setCurrencyId(
          xof?.id ||
            currencyList[0].id,
        );
      }
    } catch (error: any) {
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

  const currencyCode = (
    id?: string,
  ) =>
    currencies.find(
      (currency) =>
        currency.id === id,
    )?.code ||
    id ||
    '—';

  const filteredBatches =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return batches.filter(
        (batch) => {
          if (
            statusFilter &&
            batch.status !==
              statusFilter
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          return [
            batch.id,
            batch.status,
            currencyCode(
              batch.currencyId,
            ),
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(term),
          );
        },
      );
    }, [
      batches,
      search,
      statusFilter,
      currencies,
    ]);

  const openBatch =
    async (
      batchId: string,
    ) => {
      try {
        setBatchDetailLoading(
          true,
        );

        setReport(null);
        setFinalization(null);

        const response =
          await AdminFinanceApi.getSettlementBatch(
            batchId,
          );

        setSelectedBatch(
          dataOf(response),
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setBatchDetailLoading(
          false,
        );
      }
    };

  const createBatch =
    async (
      event: React.FormEvent,
    ) => {
      event.preventDefault();

      if (
        !periodStart ||
        !periodEnd ||
        !currencyId
      ) {
        showToast(
          'Informe período e moeda.',
        );

        return;
      }

      const start =
        new Date(periodStart);

      const end =
        new Date(periodEnd);

      if (
        Number.isNaN(
          start.getTime(),
        ) ||
        Number.isNaN(
          end.getTime(),
        )
      ) {
        showToast(
          'Período inválido.',
        );

        return;
      }

      if (end <= start) {
        showToast(
          'A data final deve ser posterior à inicial.',
        );

        return;
      }

      try {
        setOperating(
          '__create__',
        );

        const response =
          await AdminFinanceApi.createSettlementBatch(
            {
              periodStart:
                start.toISOString(),

              periodEnd:
                end.toISOString(),

              currencyId,
            },
          );

        const created =
          dataOf(response);

        showToast(
          'Batch de settlement criado com sucesso.',
        );

        setCreateOpen(false);
        setPeriodStart('');
        setPeriodEnd('');

        await load();

        if (created?.id) {
          await openBatch(
            created.id,
          );
        }
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const closeBatch =
    async (
      batch: any,
    ) => {
      const confirmed =
        window.confirm(
          `Fechar o batch ${batch.id}? Depois do fechamento os settlements serão consolidados pelo backend.`,
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          batch.id,
        );

        await AdminFinanceApi.closeSettlementBatch(
          batch.id,
        );

        showToast(
          'Batch fechado com sucesso.',
        );

        await load();

        await openBatch(
          batch.id,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const reconcileBatch =
    async (
      batch: any,
    ) => {
      const note =
        window
          .prompt(
            'Nota opcional da reconciliação do batch:',
          )
          ?.trim();

      if (note === undefined) {
        return;
      }

      try {
        setOperating(
          batch.id,
        );

        const response =
          await AdminFinanceApi.reconcileSettlementBatch(
            batch.id,
            note,
          );

        const result =
          dataOf(response);

        showToast(
          `Reconciliação concluída. ${
            result?.scanned ?? 0
          } analisado(s), ${
            result?.reconciled ?? 0
          } reconciliado(s), ${
            result?.failures ?? 0
          } falha(s).`,
        );

        await openBatch(
          batch.id,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const viewReport =
    async (
      batchId: string,
    ) => {
      try {
        setOperating(
          batchId,
        );

        const response =
          await AdminFinanceApi.settlementReport(
            batchId,
          );

        setReport(
          dataOf(response),
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const viewFinalization =
    async (
      batchId: string,
    ) => {
      try {
        setOperating(
          batchId,
        );

        const response =
          await AdminFinanceApi.settlementFinalization(
            batchId,
          );

        setFinalization(
          dataOf(response),
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const openSettlement =
    async (
      batch: any,
      settlement: any,
    ) => {
      setSelectedSettlement(
        settlement,
      );

      setSettlementEligibility(
        null,
      );

      setSettlementStatement(
        null,
      );

      try {
        const [
          eligibilityResponse,
          statementResponse,
        ] = await Promise.all([
          AdminFinanceApi.settlementEligibility(
            batch.id,
            settlement.sellerId,
          ),

          AdminFinanceApi.settlementStatement(
            batch.id,
            settlement.sellerId,
          ),
        ]);

        setSettlementEligibility(
          dataOf(
            eligibilityResponse,
          ),
        );

        setSettlementStatement(
          dataOf(
            statementResponse,
          ),
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      }
    };

  const addAdjustment =
    async (
      settlement: any,
    ) => {
      if (!selectedBatch) {
        return;
      }

      const type =
        window
          .prompt(
            'Tipo do ajuste: CREDIT ou DEBIT',
            'CREDIT',
          )
          ?.trim()
          .toUpperCase();

      if (
        type !== 'CREDIT' &&
        type !== 'DEBIT'
      ) {
        if (type !== undefined) {
          showToast(
            'Tipo deve ser CREDIT ou DEBIT.',
          );
        }

        return;
      }

      const amount =
        window
          .prompt(
            'Valor do ajuste:',
          )
          ?.trim();

      if (!amount) {
        return;
      }

      const reason =
        window
          .prompt(
            'Motivo obrigatório do ajuste:',
          )
          ?.trim();

      if (!reason) {
        return;
      }

      const confirmed =
        window.confirm(
          `${type === 'CREDIT'
            ? 'Adicionar crédito'
            : 'Adicionar débito'} de ${amount} ao settlement deste vendedor?`,
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          settlement.id,
        );

        await AdminFinanceApi.addSettlementAdjustment(
          selectedBatch.id,
          settlement.sellerId,
          {
            amount,
            type,
            reason,
          },
        );

        showToast(
          'Ajuste financeiro registrado.',
        );

        await openBatch(
          selectedBatch.id,
        );

        setSelectedSettlement(
          null,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const requestPayout =
    async (
      settlement: any,
    ) => {
      if (!selectedBatch) {
        return;
      }

      if (
        settlementEligibility &&
        settlementEligibility.eligible ===
          false
      ) {
        showToast(
          'Este settlement não está elegível para payout.',
        );

        return;
      }

      const confirmed =
        window.confirm(
          'Solicitar payout deste settlement? O backend verificará novamente a elegibilidade antes de criar o payout.',
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          settlement.id,
        );

        await AdminFinanceApi.requestSettlementPayout(
          selectedBatch.id,
          settlement.sellerId,
        );

        showToast(
          'Payout do settlement solicitado.',
        );

        await openBatch(
          selectedBatch.id,
        );

        setSelectedSettlement(
          null,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const processSettlementPayout =
    async (
      settlement: any,
    ) => {
      const confirmed =
        window.confirm(
          'Processar o payout deste settlement?',
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          settlement.id,
        );

        await AdminFinanceApi.processSettlementPayout(
          settlement.id,
        );

        showToast(
          'Payout do settlement processado.',
        );

        if (selectedBatch) {
          await openBatch(
            selectedBatch.id,
          );
        }

        setSelectedSettlement(
          null,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const reconcileSettlement =
    async (
      settlement: any,
    ) => {
      const note =
        window
          .prompt(
            'Nota opcional da reconciliação:',
          )
          ?.trim();

      if (note === undefined) {
        return;
      }

      try {
        setOperating(
          settlement.id,
        );

        await AdminFinanceApi.reconcileSettlementPayout(
          settlement.id,
          note,
        );

        showToast(
          'Settlement reconciliado com o payout.',
        );

        if (selectedBatch) {
          await openBatch(
            selectedBatch.id,
          );
        }

        setSelectedSettlement(
          null,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setOperating(null);
      }
    };

  const prepareRetry =
    async (
      settlement: any,
    ) => {
      const note =
        window
          .prompt(
            'Motivo para preparar nova tentativa:',
          )
          ?.trim();

      if (note === undefined) {
        return;
      }

      const confirmed =
        window.confirm(
          'Preparar este settlement para uma nova tentativa de payout?',
        );

      if (!confirmed) {
        return;
      }

      try {
        setOperating(
          settlement.id,
        );

        await AdminFinanceApi.prepareSettlementRetry(
          settlement.id,
          note,
        );

        showToast(
          'Settlement preparado para nova tentativa.',
        );

        if (selectedBatch) {
          await openBatch(
            selectedBatch.id,
          );
        }

        setSelectedSettlement(
          null,
        );
      } catch (error: any) {
        showToast(
          errorMessage(error),
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
      <div className="bg-white border rounded-2xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Wallet className="w-6 h-6 text-purple-600" />

            Settlements
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Fechamento financeiro por período,
            cálculo por vendedor, ajustes,
            elegibilidade, payout e reconciliação.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
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
            onClick={() =>
              setCreateOpen(true)
            }
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo batch
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric
          label="Batches"
          value={batches.length}
        />

        <Metric
          label="Abertos"
          value={
            batches.filter(
              (batch) =>
                batch.status ===
                'OPEN',
            ).length
          }
        />

        <Metric
          label="Processando"
          value={
            batches.filter(
              (batch) =>
                batch.status ===
                'PROCESSING',
            ).length
          }
        />

        <Metric
          label="Fechados"
          value={
            batches.filter(
              (batch) =>
                batch.status ===
                'CLOSED',
            ).length
          }
        />
      </div>

      <div className="bg-white border rounded-2xl p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buscar ID ou moeda..."
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

          <option value="OPEN">
            OPEN
          </option>

          <option value="PROCESSING">
            PROCESSING
          </option>

          <option value="CLOSED">
            CLOSED
          </option>

          <option value="FAILED">
            FAILED
          </option>
        </select>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        {!filteredBatches.length ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhum settlement batch encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Batch
                  </th>

                  <th className="p-3">
                    Período
                  </th>

                  <th className="p-3">
                    Moeda
                  </th>

                  <th className="p-3">
                    Settlements
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
                {filteredBatches.map(
                  (batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <strong className="font-mono">
                          {batch.id}
                        </strong>
                      </td>

                      <td className="p-3">
                        <div>
                          {formatDate(
                            batch.periodStart,
                          )}
                        </div>

                        <div className="text-gray-400">
                          até{' '}
                          {formatDate(
                            batch.periodEnd,
                          )}
                        </div>
                      </td>

                      <td className="p-3 font-black">
                        {currencyCode(
                          batch.currencyId,
                        )}
                      </td>

                      <td className="p-3 font-black">
                        {batch._count
                          ?.settlements ??
                          0}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black ${batchStatusClasses(
                            batch.status,
                          )}`}
                        >
                          {batch.status}
                        </span>
                      </td>

                      <td className="p-3">
                        {formatDate(
                          batch.createdAt,
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title="Abrir batch"
                            onClick={() =>
                              void openBatch(
                                batch.id,
                              )
                            }
                            className="p-2 text-purple-700 hover:bg-purple-50 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {batch.status ===
                            'OPEN' && (
                            <button
                              type="button"
                              title="Fechar batch"
                              disabled={
                                operating ===
                                batch.id
                              }
                              onClick={() =>
                                void closeBatch(
                                  batch,
                                )
                              }
                              className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {batch.status ===
                            'CLOSED' && (
                            <button
                              type="button"
                              title="Reconciliar batch"
                              disabled={
                                operating ===
                                batch.id
                              }
                              onClick={() =>
                                void reconcileBatch(
                                  batch,
                                )
                              }
                              className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg">
                  Criar Settlement Batch
                </h3>

                <p className="text-[10px] text-gray-500 mt-1">
                  Selecione período e moeda.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCreateOpen(false)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={createBatch}
              className="space-y-4 mt-5 text-xs"
            >
              <div>
                <label className="font-bold block mb-1">
                  Início
                </label>

                <input
                  type="datetime-local"
                  required
                  value={periodStart}
                  onChange={(event) =>
                    setPeriodStart(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Final
                </label>

                <input
                  type="datetime-local"
                  required
                  value={periodEnd}
                  onChange={(event) =>
                    setPeriodEnd(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Moeda
                </label>

                <select
                  required
                  value={currencyId}
                  onChange={(event) =>
                    setCurrencyId(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                >
                  <option value="">
                    Selecione...
                  </option>

                  {currencies.map(
                    (currency) => (
                      <option
                        key={currency.id}
                        value={currency.id}
                      >
                        {currency.code} —{' '}
                        {currency.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="border-t pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCreateOpen(false)
                  }
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    operating ===
                    '__create__'
                  }
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl font-black flex items-center gap-2 disabled:opacity-50"
                >
                  {operating ===
                    '__create__' && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  Criar batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {batchDetailLoading && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] overflow-y-auto p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b pb-4 gap-3">
              <div>
                <h3 className="font-black text-xl">
                  Settlement Batch
                </h3>

                <p className="font-mono text-[10px] text-gray-500">
                  {selectedBatch.id}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void viewReport(
                      selectedBatch.id,
                    )
                  }
                  className="px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <FileText className="w-4 h-4" />
                  Relatório
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void viewFinalization(
                      selectedBatch.id,
                    )
                  }
                  className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold"
                >
                  Finalização
                </button>

                {selectedBatch.status ===
                  'OPEN' && (
                  <button
                    type="button"
                    onClick={() =>
                      void closeBatch(
                        selectedBatch,
                      )
                    }
                    className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                  >
                    Fechar
                  </button>
                )}

                {selectedBatch.status ===
                  'CLOSED' && (
                  <button
                    type="button"
                    onClick={() =>
                      void reconcileBatch(
                        selectedBatch,
                      )
                    }
                    className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black"
                  >
                    Reconciliar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBatch(
                      null,
                    );
                    setReport(null);
                    setFinalization(
                      null,
                    );
                  }}
                  className="p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
              <Metric
                label="Status"
                value={
                  selectedBatch.status
                }
              />

              <Metric
                label="Moeda"
                value={currencyCode(
                  selectedBatch.currencyId,
                )}
              />

              <Metric
                label="Settlements"
                value={
                  selectedBatch
                    .settlements
                    ?.length || 0
                }
              />

              <Metric
                label="Fechado em"
                value={formatDate(
                  selectedBatch.closedAt,
                )}
              />
            </div>

            {finalization && (
              <div className="mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <h4 className="font-black text-sm">
                  Estado de finalização
                </h4>

                <pre className="mt-3 text-[10px] whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(
                    finalization,
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}

            {report && (
              <div className="mt-5 bg-slate-950 text-white rounded-2xl p-4">
                <h4 className="font-black text-sm">
                  Relatório do batch
                </h4>

                <pre className="mt-3 text-[10px] whitespace-pre-wrap overflow-x-auto max-h-80">
                  {JSON.stringify(
                    report,
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}

            <div className="mt-6 bg-white border rounded-2xl overflow-hidden">
              <div className="p-4 border-b">
                <h4 className="font-black">
                  Settlements por vendedor
                </h4>
              </div>

              {!selectedBatch
                .settlements
                ?.length ? (
                <div className="p-10 text-center text-sm text-gray-500">
                  Nenhum settlement neste batch.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b">
                      <tr className="text-[10px] uppercase font-black text-gray-500">
                        <th className="p-3">
                          Vendedor
                        </th>

                        <th className="p-3">
                          Bruto
                        </th>

                        <th className="p-3">
                          Taxa
                        </th>

                        <th className="p-3">
                          Ajustes
                        </th>

                        <th className="p-3">
                          Payout
                        </th>

                        <th className="p-3">
                          Status
                        </th>

                        <th className="p-3 text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {selectedBatch.settlements.map(
                        (
                          settlement: any,
                        ) => (
                          <tr
                            key={
                              settlement.id
                            }
                          >
                            <td className="p-3">
                              <strong className="font-mono">
                                {
                                  settlement.sellerId
                                }
                              </strong>
                            </td>

                            <td className="p-3">
                              {formatMoney(
                                settlement.grossAmount,
                                currencyCode(
                                  selectedBatch.currencyId,
                                ),
                              )}
                            </td>

                            <td className="p-3">
                              {formatMoney(
                                settlement.platformFee,
                                currencyCode(
                                  selectedBatch.currencyId,
                                ),
                              )}
                            </td>

                            <td className="p-3">
                              {formatMoney(
                                settlement.adjustments,
                                currencyCode(
                                  selectedBatch.currencyId,
                                ),
                              )}
                            </td>

                            <td className="p-3 font-black">
                              {formatMoney(
                                settlement.payoutAmount,
                                currencyCode(
                                  selectedBatch.currencyId,
                                ),
                              )}
                            </td>

                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-[9px] font-black ${settlementStatusClasses(
                                  settlement.status,
                                )}`}
                              >
                                {
                                  settlement.status
                                }
                              </span>
                            </td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  void openSettlement(
                                    selectedBatch,
                                    settlement,
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
              )}
            </div>
          </div>
        </div>
      )}

      {selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6">
            <div className="flex justify-between border-b pb-3">
              <div>
                <h3 className="font-black">
                  Settlement do vendedor
                </h3>

                <p className="font-mono text-[10px] text-gray-500">
                  {
                    selectedSettlement.id
                  }
                </p>
              </div>

              <button
                onClick={() =>
                  setSelectedSettlement(
                    null,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <Metric
                label="Status"
                value={
                  selectedSettlement.status
                }
              />

              <Metric
                label="Payout"
                value={formatMoney(
                  selectedSettlement.payoutAmount,
                  selectedBatch
                    ? currencyCode(
                        selectedBatch.currencyId,
                      )
                    : undefined,
                )}
              />
            </div>

            {settlementEligibility && (
              <div
                className={`mt-4 border rounded-xl p-4 ${
                  settlementEligibility.eligible
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex gap-2">
                  {settlementEligibility.eligible ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                  )}

                  <div>
                    <strong className="text-xs">
                      {settlementEligibility.eligible
                        ? 'Elegível para payout'
                        : 'Não elegível para payout'}
                    </strong>

                    {Array.isArray(
                      settlementEligibility.reasons,
                    ) &&
                      settlementEligibility
                        .reasons
                        .length > 0 && (
                        <div className="text-[10px] mt-1">
                          {settlementEligibility.reasons.join(
                            ', ',
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {settlementStatement && (
              <div className="mt-4">
                <h4 className="text-xs font-black">
                  Demonstrativo
                </h4>

                <pre className="mt-2 bg-slate-950 text-slate-100 rounded-xl p-4 text-[10px] whitespace-pre-wrap overflow-x-auto max-h-72">
                  {JSON.stringify(
                    settlementStatement,
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}

            <div className="border-t mt-5 pt-4 flex flex-wrap justify-end gap-2">
              {selectedSettlement.status !==
                'SETTLED' && (
                <button
                  type="button"
                  disabled={
                    operating ===
                    selectedSettlement.id
                  }
                  onClick={() =>
                    void addAdjustment(
                      selectedSettlement,
                    )
                  }
                  className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold"
                >
                  Adicionar ajuste
                </button>
              )}

              {selectedSettlement.status ===
                'READY' && (
                <button
                  type="button"
                  disabled={
                    operating ===
                    selectedSettlement.id
                  }
                  onClick={() =>
                    void requestPayout(
                      selectedSettlement,
                    )
                  }
                  className="px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-black"
                >
                  Solicitar payout
                </button>
              )}

              {selectedSettlement.status ===
                'PAYOUT_PENDING' && (
                <button
                  type="button"
                  disabled={
                    operating ===
                    selectedSettlement.id
                  }
                  onClick={() =>
                    void processSettlementPayout(
                      selectedSettlement,
                    )
                  }
                  className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                >
                  Processar payout
                </button>
              )}

              {selectedSettlement.payoutId && (
                <button
                  type="button"
                  disabled={
                    operating ===
                    selectedSettlement.id
                  }
                  onClick={() =>
                    void reconcileSettlement(
                      selectedSettlement,
                    )
                  }
                  className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold"
                >
                  Reconciliar
                </button>
              )}

              {selectedSettlement.status ===
                'FAILED' && (
                <button
                  type="button"
                  disabled={
                    operating ===
                    selectedSettlement.id
                  }
                  onClick={() =>
                    void prepareRetry(
                      selectedSettlement,
                    )
                  }
                  className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Preparar retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="bg-white border rounded-2xl p-4">
    <div className="text-[9px] uppercase font-black text-gray-400">
      {label}
    </div>

    <div className="text-lg font-black mt-1 break-all">
      {value}
    </div>
  </div>
);