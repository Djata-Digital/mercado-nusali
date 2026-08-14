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
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  Truck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import {
  AdminReturnsApi,
  ReturnStatus,
} from '../../api/clients/AdminReturnsApi';

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

const arrayOf = (
  response: any,
): any[] => {
  const data =
    dataOf(response);

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

const buyerName = (
  item: any,
) => {
  const name =
    `${item.buyer?.firstName || ''} ${item.buyer?.lastName || ''}`.trim();

  return (
    name ||
    item.buyer?.email ||
    item.buyerId ||
    'Comprador'
  );
};

const sellerName = (
  item: any,
) =>
  item.seller?.tradeName ||
  item.seller?.legalName ||
  item.sellerId ||
  'Vendedor';

const statusLabel:
Record<
  string,
  string
> = {
  REQUESTED:
    'Solicitada',

  AUTHORIZED:
    'Autorizada',

  REJECTED:
    'Rejeitada',

  IN_TRANSIT:
    'Em trânsito',

  RECEIVED_AT_HUB:
    'Recebida no HUB',

  INSPECTING:
    'Em vistoria',

  APPROVED:
    'Aprovada',

  REFUND_PENDING:
    'Reembolso pendente',

  REFUNDED:
    'Reembolsada',

  CLOSED:
    'Encerrada',

  CANCELLED:
    'Cancelada',
};

const badge = (
  status?: string,
) => {
  switch (status) {
    case 'REQUESTED':
      return 'bg-amber-100 text-amber-700';

    case 'AUTHORIZED':
      return 'bg-blue-100 text-blue-700';

    case 'IN_TRANSIT':
      return 'bg-purple-100 text-purple-700';

    case 'RECEIVED_AT_HUB':
    case 'INSPECTING':
      return 'bg-cyan-100 text-cyan-700';

    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-700';

    case 'REFUND_PENDING':
      return 'bg-orange-100 text-orange-700';

    case 'REFUNDED':
    case 'CLOSED':
      return 'bg-emerald-100 text-emerald-700';

    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const AdminReturnsManager:
React.FC<Props> = ({
  showToast,
}) => {
  const [
    returns,
    setReturns,
  ] = useState<any[]>(
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
    selected,
    setSelected,
  ] = useState<any>(
    null,
  );

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    status,
    setStatus,
  ] =
    useState<
      '' | ReturnStatus
    >('');

  const load =
    async () => {
      try {
        setLoading(true);

        const response =
          await AdminReturnsApi.list(
            {
              ...(status
                ? {
                    status,
                  }
                : {}),

              limit: 200,
            },
          );

        setReturns(
          arrayOf(
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
  }, [status]);

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return returns;
      }

      return returns.filter(
        (item) =>
          [
            item.returnNumber,
            item.order?.orderNumber,
            item.orderId,
            buyerName(
              item,
            ),
            sellerName(
              item,
            ),
            item.reverseTrackingCode,
            item.reason,
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
      returns,
      search,
    ]);

  const counts =
    useMemo(
      () => ({
        total:
          returns.length,

        requested:
          returns.filter(
            (item) =>
              item.status ===
              'REQUESTED',
          ).length,

        transit:
          returns.filter(
            (item) =>
              item.status ===
              'IN_TRANSIT',
          ).length,

        inspection:
          returns.filter(
            (item) =>
              [
                'RECEIVED_AT_HUB',
                'INSPECTING',
              ].includes(
                item.status,
              ),
          ).length,

        refunds:
          returns.filter(
            (item) =>
              [
                'REFUND_PENDING',
                'REFUNDED',
              ].includes(
                item.status,
              ),
          ).length,
      }),
      [returns],
    );

  const refreshSelected =
    async (
      id: string,
    ) => {
      const response =
        await AdminReturnsApi.get(
          id,
        );

      setSelected(
        dataOf(response),
      );
    };

  const run = async (
    key: string,
    action: () =>
      Promise<any>,
    success:
      string,
    id?: string,
  ) => {
    try {
      setOperating(
        key,
      );

      await action();

      showToast(
        success,
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

  const authorize =
    async (
      item: any,
    ) => {
      const note =
        window
          .prompt(
            'Observação da autorização (opcional):',
          )
          ?.trim();

      if (
        note === undefined
      ) {
        return;
      }

      await run(
        `authorize-${item.id}`,

        () =>
          AdminReturnsApi.authorize(
            item.id,
            {
              note:
                note ||
                undefined,
            },
          ),

        'Devolução autorizada e código de logística reversa gerado.',

        item.id,
      );
    };

  const reject =
    async (
      item: any,
    ) => {
      const reason =
        window
          .prompt(
            'Informe o motivo da rejeição:',
          )
          ?.trim();

      if (!reason) {
        return;
      }

      if (
        !window.confirm(
          'Confirmar rejeição desta devolução?',
        )
      ) {
        return;
      }

      await run(
        `reject-${item.id}`,

        () =>
          AdminReturnsApi.reject(
            item.id,
            reason,
          ),

        'Solicitação de devolução rejeitada.',

        item.id,
      );
    };

  const inspect =
    async (
      item: any,
      decision:
        | 'APPROVED'
        | 'REJECTED',
    ) => {
      const notes =
        window
          .prompt(
            decision ===
              'APPROVED'
              ? 'Observação da vistoria (opcional):'
              : 'Informe por que a devolução foi reprovada na vistoria:',
          )
          ?.trim();

      if (
        notes ===
        undefined
      ) {
        return;
      }

      if (
        decision ===
          'REJECTED' &&
        !notes
      ) {
        showToast(
          'Informe o motivo da reprovação.',
        );

        return;
      }

      await run(
        `inspect-${item.id}`,

        () =>
          AdminReturnsApi.inspect(
            item.id,
            {
              decision,
              notes:
                notes ||
                undefined,
            },
          ),

        decision ===
          'APPROVED'
          ? 'Vistoria aprovada.'
          : 'Vistoria rejeitada.',

        item.id,
      );
    };

  if (
    loading &&
    !returns.length
  ) {
    return (
      <div className="bg-white border rounded-2xl min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-purple-600" />

            Devoluções & Logística Reversa
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Fluxo real desde a solicitação do comprador até recebimento no HUB, vistoria e reembolso.
          </p>
        </div>

        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            void load()
          }
          className="px-4 py-2.5 bg-gray-100 rounded-xl text-xs font-bold flex items-center gap-2"
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
          label="Solicitadas"
          value={
            counts.requested
          }
        />

        <Metric
          label="Em trânsito"
          value={
            counts.transit
          }
        />

        <Metric
          label="No HUB / vistoria"
          value={
            counts.inspection
          }
        />

        <Metric
          label="Refunds"
          value={
            counts.refunds
          }
        />
      </div>

      <div className="bg-white border rounded-2xl p-4 flex flex-col lg:flex-row gap-3">
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
            placeholder="Devolução, pedido, comprador, vendedor ou tracking..."
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
                .value as
                | ''
                | ReturnStatus,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos os status
          </option>

          {Object.entries(
            statusLabel,
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
          <PackageCheck className="w-10 h-10 text-emerald-500 mx-auto" />

          <h3 className="font-black mt-3">
            Nenhuma devolução encontrada
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Quando compradores solicitarem devoluções reais, elas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Devolução
                  </th>

                  <th className="p-3">
                    Pedido
                  </th>

                  <th className="p-3">
                    Comprador → Vendedor
                  </th>

                  <th className="p-3">
                    Tracking reverso
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
                {filtered.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <strong className="font-mono">
                          {item.returnNumber}
                        </strong>
                      </td>

                      <td className="p-3 font-bold text-purple-700">
                        {item.order
                          ?.orderNumber ||
                          item.orderId}
                      </td>

                      <td className="p-3">
                        <strong>
                          {buyerName(
                            item,
                          )}
                        </strong>

                        <span className="text-gray-400 mx-1">
                          →
                        </span>

                        <strong>
                          {sellerName(
                            item,
                          )}
                        </strong>
                      </td>

                      <td className="p-3 font-mono">
                        {item.reverseTrackingCode ||
                          'Aguardando autorização'}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black ${badge(
                            item.status,
                          )}`}
                        >
                          {statusLabel[
                            item.status
                          ] ||
                            item.status}
                        </span>
                      </td>

                      <td className="p-3">
                        {date(
                          item.requestedAt,
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              void refreshSelected(
                                item.id,
                              )
                            }
                            className="p-2 text-purple-700 hover:bg-purple-50 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {item.status ===
                            'REQUESTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void authorize(
                                    item,
                                  )
                                }
                                className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void reject(
                                    item,
                                  )
                                }
                                className="p-2 text-red-700 hover:bg-red-50 rounded-lg"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
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
                <h2 className="font-black text-xl">
                  {selected.returnNumber}
                </h2>

                <p className="text-[10px] text-gray-500">
                  Pedido{' '}
                  {selected.order
                    ?.orderNumber ||
                    selected.orderId}
                </p>
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

            <div className="p-5 space-y-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Info
                  label="Status"
                  value={
                    statusLabel[
                      selected.status
                    ] ||
                    selected.status
                  }
                />

                <Info
                  label="Comprador"
                  value={buyerName(
                    selected,
                  )}
                />

                <Info
                  label="Vendedor"
                  value={sellerName(
                    selected,
                  )}
                />

                <Info
                  label="Tracking reverso"
                  value={
                    selected.reverseTrackingCode ||
                    '—'
                  }
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />

                  <div>
                    <strong className="text-xs">
                      Motivo
                    </strong>

                    <p className="text-xs mt-1">
                      {selected.reason}
                      {selected.reasonDetails
                        ? ` — ${selected.reasonDetails}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-2xl overflow-hidden">
                <div className="p-4 border-b font-black text-sm">
                  Itens devolvidos
                </div>

                <div className="divide-y">
                  {selected.items?.map(
                    (
                      item: any,
                    ) => (
                      <div
                        key={
                          item.id
                        }
                        className="p-4 flex justify-between gap-4 text-xs"
                      >
                        <div>
                          <strong>
                            {item.orderItem
                              ?.productTitleSnapshot ||
                              item.orderItemId}
                          </strong>

                          <div className="text-gray-500 mt-1">
                            Qtd. devolvida:{' '}
                            {
                              item.quantity
                            }
                          </div>
                        </div>

                        <div className="text-right">
                          {item.reason ||
                            selected.reason}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-5">
                <h3 className="font-black text-sm flex gap-2 items-center">
                  <Clock3 className="w-4 h-4 text-purple-600" />

                  Histórico
                </h3>

                <div className="mt-4 border-l-2 border-purple-200 pl-4 space-y-4">
                  {selected.history?.map(
                    (
                      history: any,
                    ) => (
                      <div
                        key={
                          history.id
                        }
                      >
                        <strong className="text-xs">
                          {statusLabel[
                            history.newStatus
                          ] ||
                            history.newStatus}
                        </strong>

                        <p className="text-[10px] text-gray-600 mt-1">
                          {history.reason ||
                            '—'}
                        </p>

                        <span className="text-[9px] text-gray-400">
                          {date(
                            history.createdAt,
                          )}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {selected.refund && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex gap-3">
                    <Wallet className="w-5 h-5 text-blue-700" />

                    <div className="flex-1">
                      <strong className="text-xs">
                        Refund vinculado
                      </strong>

                      <div className="text-[10px] mt-1 font-mono">
                        {
                          selected.refund.id
                        }
                      </div>

                      <div className="text-[10px] mt-1">
                        Status financeiro:{' '}
                        <strong>
                          {
                            selected.refund.status
                          }
                        </strong>
                      </div>
                    </div>

                    {selected.status ===
                      'REFUND_PENDING' && (
                      <button
                        type="button"
                        disabled={
                          operating ===
                          `sync-${selected.id}`
                        }
                        onClick={() =>
                          void run(
                            `sync-${selected.id}`,

                            () =>
                              AdminReturnsApi.syncRefund(
                                selected.id,
                              ),

                            'Estado financeiro sincronizado.',

                            selected.id,
                          )
                        }
                        className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-black self-center"
                      >
                        Sincronizar
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white border rounded-2xl p-5">
                <h3 className="font-black text-sm">
                  Próxima ação
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.status ===
                    'REQUESTED' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void authorize(
                            selected,
                          )
                        }
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                      >
                        Autorizar devolução
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void reject(
                            selected,
                          )
                        }
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-black"
                      >
                        Rejeitar
                      </button>
                    </>
                  )}

                  {selected.status ===
                    'AUTHORIZED' && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          `transit-${selected.id}`,

                          () =>
                            AdminReturnsApi.markInTransit(
                              selected.id,
                            ),

                          'Devolução marcada como em trânsito.',

                          selected.id,
                        )
                      }
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black flex gap-2 items-center"
                    >
                      <Truck className="w-4 h-4" />

                      Marcar em trânsito
                    </button>
                  )}

                  {[
                    'AUTHORIZED',
                    'IN_TRANSIT',
                  ].includes(
                    selected.status,
                  ) && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          `receive-${selected.id}`,

                          () =>
                            AdminReturnsApi.receiveAtHub(
                              selected.id,
                            ),

                          'Devolução recebida no HUB.',

                          selected.id,
                        )
                      }
                      className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-black"
                    >
                      Receber no HUB
                    </button>
                  )}

                  {selected.status ===
                    'RECEIVED_AT_HUB' && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          `inspection-${selected.id}`,

                          () =>
                            AdminReturnsApi.startInspection(
                              selected.id,
                            ),

                          'Vistoria iniciada.',

                          selected.id,
                        )
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black"
                    >
                      Iniciar vistoria
                    </button>
                  )}

                  {[
                    'RECEIVED_AT_HUB',
                    'INSPECTING',
                  ].includes(
                    selected.status,
                  ) && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void inspect(
                            selected,
                            'APPROVED',
                          )
                        }
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black"
                      >
                        Aprovar vistoria
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void inspect(
                            selected,
                            'REJECTED',
                          )
                        }
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-black"
                      >
                        Reprovar vistoria
                      </button>
                    </>
                  )}

                  {selected.status ===
                    'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Gerar o reembolso financeiro real desta devolução?',
                          )
                        ) {
                          return;
                        }

                        void run(
                          `refund-${selected.id}`,

                          () =>
                            AdminReturnsApi.refund(
                              selected.id,
                            ),

                          'Reembolso da devolução iniciado.',

                          selected.id,
                        );
                      }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black flex gap-2 items-center"
                    >
                      <Wallet className="w-4 h-4" />

                      Gerar reembolso
                    </button>
                  )}

                  {selected.status ===
                    'REFUNDED' && (
                    <div className="flex items-center gap-2 text-emerald-700 text-xs font-black">
                      <CheckCircle2 className="w-5 h-5" />

                      Fluxo concluído
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Metric:
React.FC<{
  label: string;
  value: React.ReactNode;
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
  value: React.ReactNode;
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