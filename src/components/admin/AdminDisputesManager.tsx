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
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Store,
  User,
  Wallet,
  X,
} from 'lucide-react';

import { AdminDisputesApi } from '../../api/clients/AdminDisputesApi';

interface AdminDisputesManagerProps {
  showToast: (msg: string) => void;
}

type FilterStatus =
  | ''
  | 'OPEN'
  | 'RESOLVED';

type ResolutionOutcome =
  | 'BUYER_WINS'
  | 'SELLER_WINS';

const getData = (
  response: any,
) =>
  response?.data?.data ??
  response?.data ??
  null;

const getArray = (
  response: any,
): any[] => {
  const data =
    getData(response);

  if (Array.isArray(data)) {
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

const getErrorMessage = (
  error: any,
) =>
  error?.response?.data
    ?.error?.message ||
  error?.response?.data
    ?.message ||
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

const formatMoney = (
  value: any,
  currencyCode?: string,
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  const numeric =
    Number(value);

  if (
    Number.isFinite(
      numeric,
    ) &&
    currencyCode
  ) {
    try {
      return new Intl.NumberFormat(
        'pt-BR',
        {
          style:
            'currency',

          currency:
            currencyCode,
        },
      ).format(
        numeric,
      );
    } catch {
      return `${value} ${currencyCode}`;
    }
  }

  return `${value}${
    currencyCode
      ? ` ${currencyCode}`
      : ''
  }`;
};

const buyerName = (
  dispute: any,
) => {
  const first =
    dispute.user
      ?.firstName ||
    '';

  const last =
    dispute.user
      ?.lastName ||
    '';

  const name =
    `${first} ${last}`.trim();

  return (
    name ||
    dispute.user
      ?.email ||
    dispute.userId ||
    'Comprador'
  );
};

const sellerName = (
  dispute: any,
) =>
  dispute.seller
    ?.tradeName ||
  dispute.seller
    ?.legalName ||
  dispute.store
    ?.name ||
  dispute.sellerId ||
  'Vendedor';

const getOpeningHistory = (
  dispute: any,
) =>
  Array.isArray(
    dispute.statusHistory,
  )
    ? dispute.statusHistory.find(
        (
          history: any,
        ) =>
          history.newStatus ===
          'DISPUTED',
      )
    : null;

const getResolutionHistory = (
  dispute: any,
) =>
  Array.isArray(
    dispute.statusHistory,
  )
    ? dispute.statusHistory
        .filter(
          (
            history: any,
          ) =>
            history.previousStatus ===
            'DISPUTED',
        )
        .at(-1)
    : null;

const disputeReason = (
  dispute: any,
) =>
  getOpeningHistory(
    dispute,
  )?.reason ||
  dispute.comments?.find(
    (
      comment: any,
    ) =>
      comment.metadataJson
        ?.type ===
      'DISPUTE_OPENING_REASON',
  )?.comment ||
  'Motivo não informado.';

const isOpen = (
  dispute: any,
) =>
  dispute.status ===
  'DISPUTED';

const outcomeOf = (
  dispute: any,
):
  | ResolutionOutcome
  | null => {
  if (
    dispute.status ===
    'REFUNDED'
  ) {
    return 'BUYER_WINS';
  }

  if (
    dispute.status ===
    'COMPLETED'
  ) {
    return 'SELLER_WINS';
  }

  const resolution =
    getResolutionHistory(
      dispute,
    );

  const text =
    String(
      resolution?.reason ||
        '',
    ).toUpperCase();

  if (
    text.includes(
      'BUYER_WINS',
    )
  ) {
    return 'BUYER_WINS';
  }

  if (
    text.includes(
      'SELLER_WINS',
    )
  ) {
    return 'SELLER_WINS';
  }

  return null;
};

const disputeComments = (
  dispute: any,
) => {
  if (
    !Array.isArray(
      dispute.comments,
    )
  ) {
    return [];
  }

  return dispute.comments.filter(
    (
      comment: any,
    ) => {
      const type =
        String(
          comment
            .metadataJson
            ?.type ||
            '',
        );

      return (
        type.includes(
          'DISPUTE',
        ) ||
        type ===
          'DISPUTE_MEDIATION_MESSAGE'
      );
    },
  );
};

const statusBadge = (
  dispute: any,
) => {
  if (
    isOpen(dispute)
  ) {
    return {
      label:
        'EM MEDIAÇÃO',

      className:
        'bg-red-100 text-red-700',
    };
  }

  const outcome =
    outcomeOf(
      dispute,
    );

  if (
    outcome ===
    'BUYER_WINS'
  ) {
    return {
      label:
        'COMPRADOR VENCEU',

      className:
        'bg-blue-100 text-blue-700',
    };
  }

  if (
    outcome ===
    'SELLER_WINS'
  ) {
    return {
      label:
        'VENDEDOR VENCEU',

      className:
        'bg-emerald-100 text-emerald-700',
    };
  }

  return {
    label:
      dispute.status ||
      'RESOLVIDA',

    className:
      'bg-gray-100 text-gray-700',
  };
};

export const AdminDisputesManager:
React.FC<
  AdminDisputesManagerProps
> = ({
  showToast,
}) => {
  const [
    disputes,
    setDisputes,
  ] = useState<
    any[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(
    false,
  );

  const [
    operating,
    setOperating,
  ] = useState<
    string | null
  >(null);

  const [
    selectedDispute,
    setSelectedDispute,
  ] = useState<
    any | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<FilterStatus>(
      '',
    );

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    privateMessage,
    setPrivateMessage,
  ] = useState(
    false,
  );

  const [
    resolutionNote,
    setResolutionNote,
  ] = useState('');

  const load =
    async () => {
      try {
        setLoading(
          true,
        );

        const response =
          await AdminDisputesApi.list(
            {
              ...(statusFilter
                ? {
                    status:
                      statusFilter,
                  }
                : {}),

              limit: 200,
            },
          );

        setDisputes(
          getArray(
            response,
          ),
        );
      } catch (
        error: any
      ) {
        showToast(
          getErrorMessage(
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
    statusFilter,
  ]);

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return disputes;
      }

      return disputes.filter(
        (
          dispute,
        ) => {
          const products =
            Array.isArray(
              dispute.items,
            )
              ? dispute.items
                  .map(
                    (
                      item: any,
                    ) =>
                      item.productTitleSnapshot,
                  )
                  .join(
                    ' ',
                  )
              : '';

          return [
            dispute.id,
            dispute.orderNumber,
            buyerName(
              dispute,
            ),
            sellerName(
              dispute,
            ),
            dispute.store
              ?.name,
            disputeReason(
              dispute,
            ),
            products,
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
          );
        },
      );
    }, [
      disputes,
      search,
    ]);

  const counts =
    useMemo(() => {
      const open =
        disputes.filter(
          isOpen,
        ).length;

      const buyerWins =
        disputes.filter(
          (dispute) =>
            outcomeOf(
              dispute,
            ) ===
            'BUYER_WINS',
        ).length;

      const sellerWins =
        disputes.filter(
          (dispute) =>
            outcomeOf(
              dispute,
            ) ===
            'SELLER_WINS',
        ).length;

      return {
        total:
          disputes.length,

        open,

        buyerWins,

        sellerWins,
      };
    }, [
      disputes,
    ]);

  const openDetails =
    async (
      orderId: string,
    ) => {
      try {
        setDetailLoading(
          true,
        );

        setMessage('');
        setPrivateMessage(
          false,
        );

        setResolutionNote(
          '',
        );

        const response =
          await AdminDisputesApi.getByOrderId(
            orderId,
          );

        setSelectedDispute(
          getData(
            response,
          ),
        );
      } catch (
        error: any
      ) {
        showToast(
          getErrorMessage(
            error,
          ),
        );
      } finally {
        setDetailLoading(
          false,
        );
      }
    };

  const refreshSelected =
    async () => {
      if (
        !selectedDispute
          ?.id
      ) {
        return;
      }

      const response =
        await AdminDisputesApi.getByOrderId(
          selectedDispute.id,
        );

      setSelectedDispute(
        getData(
          response,
        ),
      );
    };

  const sendMessage =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      if (
        !selectedDispute
      ) {
        return;
      }

      const normalized =
        message.trim();

      if (
        !normalized
      ) {
        showToast(
          'Digite uma mensagem.',
        );

        return;
      }

      try {
        setOperating(
          '__message__',
        );

        await AdminDisputesApi.addMessage(
          selectedDispute.id,
          {
            message:
              normalized,

            isPrivate:
              privateMessage,
          },
        );

        setMessage('');

        showToast(
          privateMessage
            ? 'Nota interna registrada na mediação.'
            : 'Mensagem registrada na mediação.',
        );

        await refreshSelected();
        await load();
      } catch (
        error: any
      ) {
        showToast(
          getErrorMessage(
            error,
          ),
        );
      } finally {
        setOperating(
          null,
        );
      }
    };

  const resolve =
    async (
      outcome:
        ResolutionOutcome,
    ) => {
      if (
        !selectedDispute
      ) {
        return;
      }

      const buyerWins =
        outcome ===
        'BUYER_WINS';

      const confirmed =
        window.confirm(
          buyerWins
            ? 'Confirmar decisão a favor do comprador? O backend executará o reembolso real do saldo retido no Escrow.'
            : 'Confirmar decisão a favor do vendedor? O backend liberará o saldo retido no Escrow ao vendedor.',
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setOperating(
          outcome,
        );

        await AdminDisputesApi.resolve(
          selectedDispute.id,
          {
            outcome,

            note:
              resolutionNote
                .trim() ||
              undefined,
          },
        );

        showToast(
          buyerWins
            ? 'Disputa resolvida a favor do comprador. O fluxo real de reembolso foi executado.'
            : 'Disputa resolvida a favor do vendedor. O Escrow foi liberado pelo backend.',
        );

        setSelectedDispute(
          null,
        );

        setResolutionNote(
          '',
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          getErrorMessage(
            error,
          ),
        );
      } finally {
        setOperating(
          null,
        );
      }
    };

  if (
    loading &&
    !disputes.length
  ) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-600" />

            Central de Disputas
          </h1>

          <p className="text-xs text-gray-500 mt-1 max-w-3xl">
            Mediação administrativa ligada
            ao pedido, histórico, mensagens,
            anexos e Escrow real da
            plataforma.
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
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-2 self-start disabled:opacity-50"
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

      {/* MÉTRICAS */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Disputas carregadas"
          value={
            counts.total
          }
          icon={
            <Scale className="w-5 h-5" />
          }
        />

        <MetricCard
          label="Em mediação"
          value={
            counts.open
          }
          icon={
            <Clock3 className="w-5 h-5" />
          }
        />

        <MetricCard
          label="Comprador venceu"
          value={
            counts.buyerWins
          }
          icon={
            <User className="w-5 h-5" />
          }
        />

        <MetricCard
          label="Vendedor venceu"
          value={
            counts.sellerWins
          }
          icon={
            <Store className="w-5 h-5" />
          }
        />
      </div>

      {/* FILTROS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
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
            placeholder="Pedido, comprador, vendedor, loja, produto ou motivo..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-100"
          />
        </div>

        <select
          value={
            statusFilter
          }
          onChange={(
            event,
          ) =>
            setStatusFilter(
              event.target
                .value as FilterStatus,
            )
          }
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
        >
          <option value="">
            Todas as disputas
          </option>

          <option value="OPEN">
            Em mediação
          </option>

          <option value="RESOLVED">
            Resolvidas
          </option>
        </select>
      </div>

      {/* LISTA */}
      {!filtered.length ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />

          <h3 className="font-black text-gray-900">
            Nenhuma disputa encontrada
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Não existem registros para
            os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filtered.map(
            (
              dispute,
            ) => {
              const badge =
                statusBadge(
                  dispute,
                );

              const currency =
                dispute.currency
                  ?.code ||
                dispute
                  .escrowAccount
                  ?.currency
                  ?.code;

              const opening =
                getOpeningHistory(
                  dispute,
                );

              return (
                <div
                  key={
                    dispute.id
                  }
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 hover:border-purple-300 transition"
                >
                  <div className="flex justify-between gap-4 items-start">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-gray-400 block font-mono break-all">
                        Pedido:{' '}
                        {dispute.orderNumber ||
                          dispute.id}
                      </span>

                      <h3 className="font-black text-sm text-gray-900 mt-1">
                        {dispute
                          .items?.[0]
                          ?.productTitleSnapshot ||
                          'Pedido em disputa'}
                      </h3>

                      <p className="text-xs text-purple-700 font-bold mt-1">
                        {buyerName(
                          dispute,
                        )}{' '}
                        <span className="text-gray-400">
                          vs
                        </span>{' '}
                        {sellerName(
                          dispute,
                        )}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full ${badge.className}`}
                    >
                      {
                        badge.label
                      }
                    </span>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <span className="text-[10px] uppercase tracking-wide font-black text-gray-400">
                      Motivo
                    </span>

                    <p className="text-xs text-gray-700 mt-1">
                      {disputeReason(
                        dispute,
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-black">
                        Escrow retido
                      </span>

                      <div className="font-black mt-1">
                        {formatMoney(
                          dispute
                            .escrowAccount
                            ?.heldAmount,
                          currency,
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-black">
                        Total pedido
                      </span>

                      <div className="font-black mt-1">
                        {formatMoney(
                          dispute.total,
                          currency,
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-black">
                        Loja
                      </span>

                      <div className="font-bold mt-1">
                        {dispute.store
                          ?.name ||
                          '—'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] text-gray-400 uppercase font-black">
                        Aberta em
                      </span>

                      <div className="font-bold mt-1">
                        {formatDate(
                          opening
                            ?.createdAt,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                    <div className="text-[10px] text-gray-400">
                      {dispute
                        .items
                        ?.length ||
                        0}{' '}
                      item(ns) •{' '}
                      {dispute
                        .attachments
                        ?.length ||
                        0}{' '}
                      anexo(s)
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void openDetails(
                          dispute.id,
                        )
                      }
                      className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-black flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />

                      Abrir mediação
                    </button>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* LOADING DETAIL */}
      {detailLoading && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center">
          <Loader2 className="w-9 h-9 animate-spin text-white" />
        </div>
      )}

      {/* SALA DE MEDIAÇÃO */}
      {selectedDispute && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-gray-50 rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl">
            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 rounded-t-3xl px-5 sm:px-7 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-600" />

                  <h2 className="font-black text-xl text-gray-900">
                    Sala de Mediação
                  </h2>
                </div>

                <div className="font-mono text-[10px] text-gray-400 mt-1">
                  {selectedDispute.orderNumber ||
                    selectedDispute.id}{' '}
                  •{' '}
                  {
                    selectedDispute.id
                  }
                </div>
              </div>

              <div className="flex items-center gap-3">
                {(() => {
                  const badge =
                    statusBadge(
                      selectedDispute,
                    );

                  return (
                    <span
                      className={`text-[9px] font-black px-3 py-1.5 rounded-full ${badge.className}`}
                    >
                      {
                        badge.label
                      }
                    </span>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDispute(
                      null,
                    );

                    setResolutionNote(
                      '',
                    );

                    setMessage('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-6">
              {/* PARTES + ESCROW */}
              <div className="grid lg:grid-cols-3 gap-4">
                <InfoCard
                  icon={
                    <User className="w-5 h-5" />
                  }
                  title="Comprador"
                >
                  <strong className="block">
                    {buyerName(
                      selectedDispute,
                    )}
                  </strong>

                  <span className="text-[10px] text-gray-500 block mt-1">
                    {selectedDispute
                      .user
                      ?.email ||
                      '—'}
                  </span>

                  <span className="text-[10px] text-gray-500 block">
                    {selectedDispute
                      .user
                      ?.phoneCode ||
                      ''}{' '}
                    {selectedDispute
                      .user
                      ?.phone ||
                      ''}
                  </span>
                </InfoCard>

                <InfoCard
                  icon={
                    <Store className="w-5 h-5" />
                  }
                  title="Vendedor"
                >
                  <strong className="block">
                    {sellerName(
                      selectedDispute,
                    )}
                  </strong>

                  <span className="text-[10px] text-gray-500 block mt-1">
                    Loja:{' '}
                    {selectedDispute
                      .store
                      ?.name ||
                      '—'}
                  </span>
                </InfoCard>

                <InfoCard
                  icon={
                    <Wallet className="w-5 h-5" />
                  }
                  title="Custódia"
                >
                  <strong className="block text-lg">
                    {formatMoney(
                      selectedDispute
                        .escrowAccount
                        ?.heldAmount,
                      selectedDispute
                        .currency
                        ?.code ||
                        selectedDispute
                          .escrowAccount
                          ?.currency
                          ?.code,
                    )}
                  </strong>

                  <span className="text-[10px] text-gray-500 block mt-1">
                    Status Escrow:{' '}
                    {selectedDispute
                      .escrowAccount
                      ?.status ||
                      '—'}
                  </span>
                </InfoCard>
              </div>

              {/* MOTIVO */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />

                  <div>
                    <h3 className="text-xs font-black text-amber-900 uppercase">
                      Motivo da disputa
                    </h3>

                    <p className="text-sm text-amber-900 mt-2">
                      {disputeReason(
                        selectedDispute,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* PRODUTOS */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-black text-sm">
                    Itens envolvidos
                  </h3>
                </div>

                {!selectedDispute
                  .items
                  ?.length ? (
                  <div className="p-6 text-xs text-gray-500">
                    Nenhum item encontrado.
                  </div>
                ) : (
                  <div className="divide-y">
                    {selectedDispute.items.map(
                      (
                        item: any,
                      ) => (
                        <div
                          key={
                            item.id
                          }
                          className="p-4 grid sm:grid-cols-[1fr_auto] gap-3"
                        >
                          <div>
                            <strong className="text-xs block">
                              {
                                item.productTitleSnapshot
                              }
                            </strong>

                            <span className="text-[10px] text-gray-500">
                              {item.variantNameSnapshot ||
                                '—'}{' '}
                              • SKU{' '}
                              {item.skuSnapshot ||
                                '—'}{' '}
                              • Qtd.{' '}
                              {item.quantity}
                            </span>
                          </div>

                          <strong className="text-xs">
                            {formatMoney(
                              item.total,
                              selectedDispute
                                .currency
                                ?.code,
                            )}
                          </strong>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="grid xl:grid-cols-2 gap-5">
                {/* TIMELINE */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-purple-600" />

                    Linha do tempo
                  </h3>

                  <div className="mt-4 space-y-3 border-l-2 border-purple-200 pl-4">
                    {[
                      ...(selectedDispute.timeline ||
                        []),
                    ]
                      .sort(
                        (
                          a: any,
                          b: any,
                        ) =>
                          new Date(
                            a.createdAt,
                          ).getTime() -
                          new Date(
                            b.createdAt,
                          ).getTime(),
                      )
                      .map(
                        (
                          event: any,
                        ) => (
                          <div
                            key={
                              event.id
                            }
                          >
                            <div className="text-xs font-black">
                              {
                                event.title
                              }
                            </div>

                            {event.description && (
                              <div className="text-[10px] text-gray-600 mt-1">
                                {
                                  event.description
                                }
                              </div>
                            )}

                            <div className="text-[9px] text-gray-400 mt-1">
                              {formatDate(
                                event.createdAt,
                              )}
                            </div>
                          </div>
                        ),
                      )}

                    {!selectedDispute
                      .timeline
                      ?.length && (
                      <div className="text-xs text-gray-400">
                        Nenhum evento registrado.
                      </div>
                    )}
                  </div>
                </div>

                {/* ANEXOS */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />

                    Anexos do pedido
                  </h3>

                  <p className="text-[10px] text-gray-500 mt-1">
                    Arquivos disponíveis para
                    análise como evidências da
                    mediação.
                  </p>

                  <div className="mt-4 space-y-2">
                    {selectedDispute
                      .attachments
                      ?.map(
                        (
                          attachment: any,
                        ) => (
                          <div
                            key={
                              attachment.id
                            }
                            className="border border-gray-100 rounded-xl p-3"
                          >
                            <strong className="text-xs block break-all">
                              {
                                attachment.fileName
                              }
                            </strong>

                            <span className="text-[9px] text-gray-400">
                              {
                                attachment.mimeType
                              }{' '}
                              •{' '}
                              {formatDate(
                                attachment.createdAt,
                              )}
                            </span>
                          </div>
                        ),
                      )}

                    {!selectedDispute
                      .attachments
                      ?.length && (
                      <div className="text-xs text-gray-400">
                        Nenhum anexo registrado neste pedido.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MENSAGENS */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-5 border-b">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />

                    Mensagens da mediação
                  </h3>
                </div>

                <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
                  {disputeComments(
                    selectedDispute,
                  ).map(
                    (
                      comment: any,
                    ) => {
                      const author =
                        `${comment.author?.firstName || ''} ${comment.author?.lastName || ''}`.trim();

                      return (
                        <div
                          key={
                            comment.id
                          }
                          className={`rounded-xl p-3 border ${
                            comment.isPrivate
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className="flex justify-between gap-3">
                            <strong className="text-[10px]">
                              {author ||
                                comment.author
                                  ?.email ||
                                'Sistema'}
                            </strong>

                            {comment.isPrivate && (
                              <span className="text-[8px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-black">
                                NOTA INTERNA
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">
                            {
                              comment.comment
                            }
                          </p>

                          <div className="text-[9px] text-gray-400 mt-2">
                            {formatDate(
                              comment.createdAt,
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}

                  {!disputeComments(
                    selectedDispute,
                  ).length && (
                    <div className="text-center text-xs text-gray-400 py-5">
                      Nenhuma mensagem de mediação registrada.
                    </div>
                  )}
                </div>

                {isOpen(
                  selectedDispute,
                ) && (
                  <form
                    onSubmit={
                      sendMessage
                    }
                    className="border-t p-4 space-y-3"
                  >
                    <textarea
                      value={
                        message
                      }
                      onChange={(
                        event,
                      ) =>
                        setMessage(
                          event.target
                            .value,
                        )
                      }
                      rows={3}
                      maxLength={
                        4000
                      }
                      placeholder="Escreva uma mensagem da mediação ou uma nota interna..."
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs resize-none outline-none focus:ring-2 focus:ring-purple-100"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            privateMessage
                          }
                          onChange={(
                            event,
                          ) =>
                            setPrivateMessage(
                              event.target
                                .checked,
                            )
                          }
                        />

                        Nota interna da administração
                      </label>

                      <button
                        type="submit"
                        disabled={
                          operating ===
                          '__message__'
                        }
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {operating ===
                        '__message__' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}

                        Registrar mensagem
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* RESOLUÇÃO */}
              {isOpen(
                selectedDispute,
              ) ? (
                <div className="bg-white border-2 border-purple-200 rounded-2xl p-5">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <Scale className="w-5 h-5 text-purple-600" />

                    Decisão administrativa vinculante
                  </h3>

                  <p className="text-[10px] text-gray-500 mt-1">
                    Esta ação movimenta o saldo
                    real do Escrow. Revise as
                    evidências antes de decidir.
                  </p>

                  <textarea
                    value={
                      resolutionNote
                    }
                    onChange={(
                      event,
                    ) =>
                      setResolutionNote(
                        event.target
                          .value,
                      )
                    }
                    maxLength={
                      4000
                    }
                    rows={3}
                    placeholder="Nota da decisão (recomendado)..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs mt-4 resize-none"
                  />

                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      disabled={
                        operating !==
                        null
                      }
                      onClick={() =>
                        void resolve(
                          'BUYER_WINS',
                        )
                      }
                      className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-left disabled:opacity-50"
                    >
                      <div className="font-black text-sm flex items-center gap-2">
                        {operating ===
                        'BUYER_WINS' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}

                        Decidir pelo comprador
                      </div>

                      <div className="text-[10px] text-red-100 mt-1">
                        Executa o fluxo real de
                        reembolso do saldo retido.
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={
                        operating !==
                        null
                      }
                      onClick={() =>
                        void resolve(
                          'SELLER_WINS',
                        )
                      }
                      className="p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left disabled:opacity-50"
                    >
                      <div className="font-black text-sm flex items-center gap-2">
                        {operating ===
                        'SELLER_WINS' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Store className="w-4 h-4" />
                        )}

                        Decidir pelo vendedor
                      </div>

                      <div className="text-[10px] text-emerald-100 mt-1">
                        Libera o saldo retido no
                        Escrow ao vendedor.
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />

                    <div>
                      <h3 className="font-black text-sm text-emerald-900">
                        Disputa resolvida
                      </h3>

                      <p className="text-xs text-emerald-800 mt-1">
                        {outcomeOf(
                          selectedDispute,
                        ) ===
                        'BUYER_WINS'
                          ? 'Decisão registrada a favor do comprador.'
                          : outcomeOf(
                                selectedDispute,
                              ) ===
                              'SELLER_WINS'
                            ? 'Decisão registrada a favor do vendedor.'
                            : 'O pedido não está mais em estado DISPUTED.'}
                      </p>

                      <p className="text-[10px] text-emerald-700 mt-2">
                        {getResolutionHistory(
                          selectedDispute,
                        )?.reason ||
                          ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard:
React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}> = ({
  label,
  value,
  icon,
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <div className="flex items-center justify-between text-gray-400">
      <span className="text-[9px] uppercase tracking-wide font-black">
        {label}
      </span>

      {icon}
    </div>

    <div className="text-3xl font-black text-gray-900 mt-3">
      {value}
    </div>
  </div>
);

const InfoCard:
React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({
  icon,
  title,
  children,
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-purple-600">
      {icon}

      <span className="text-[9px] uppercase tracking-wide font-black text-gray-400">
        {title}
      </span>
    </div>

    <div className="mt-3 text-xs text-gray-800">
      {children}
    </div>
  </div>
);