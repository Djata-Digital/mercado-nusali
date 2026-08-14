import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Eye,
  LifeBuoy,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  User,
  X,
} from 'lucide-react';

import {
  AdminSupportApi,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../api/clients/AdminSupportApi';

interface AdminSupportTicketsProps {
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

const requesterName = (
  ticket: any,
) => {
  const name =
    `${ticket.requester?.firstName || ''} ${ticket.requester?.lastName || ''}`.trim();

  return (
    name ||
    ticket.requester?.email ||
    ticket.requesterId ||
    'Cliente'
  );
};

const agentName = (
  ticket: any,
) => {
  if (
    !ticket.assignedTo
  ) {
    return 'Não atribuído';
  }

  const name =
    `${ticket.assignedTo.firstName || ''} ${ticket.assignedTo.lastName || ''}`.trim();

  return (
    name ||
    ticket.assignedTo.email ||
    'Agente'
  );
};

const statusLabels:
Record<
  string,
  string
> = {
  OPEN:
    'Aberto',

  IN_PROGRESS:
    'Em atendimento',

  WAITING_CUSTOMER:
    'Aguardando cliente',

  RESOLVED:
    'Resolvido',

  CLOSED:
    'Encerrado',
};

const priorityLabels:
Record<
  string,
  string
> = {
  LOW:
    'Baixa',

  NORMAL:
    'Normal',

  HIGH:
    'Alta',

  URGENT:
    'Urgente',
};

const categoryLabels:
Record<
  string,
  string
> = {
  ORDER:
    'Pedido',

  PAYMENT:
    'Pagamento',

  RETURN:
    'Devolução',

  DISPUTE:
    'Disputa',

  SELLER_ACCOUNT:
    'Conta vendedor',

  DELIVERY:
    'Entrega',

  TECHNICAL:
    'Técnico',

  OTHER:
    'Outro',
};

const statusBadge = (
  status?: string,
) => {
  switch (status) {
    case 'OPEN':
      return 'bg-red-100 text-red-700';

    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-700';

    case 'WAITING_CUSTOMER':
      return 'bg-amber-100 text-amber-700';

    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-700';

    case 'CLOSED':
      return 'bg-gray-200 text-gray-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const priorityBadge = (
  priority?: string,
) => {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-600 text-white';

    case 'HIGH':
      return 'bg-orange-100 text-orange-700';

    case 'NORMAL':
      return 'bg-blue-50 text-blue-700';

    case 'LOW':
      return 'bg-gray-100 text-gray-600';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const AdminSupportTickets:
React.FC<
  AdminSupportTicketsProps
> = ({
  showToast,
}) => {
  const [
    tickets,
    setTickets,
  ] = useState<any[]>(
    [],
  );

  const [
    selectedTicket,
    setSelectedTicket,
  ] = useState<any>(
    null,
  );

  const [
    replyText,
    setReplyText,
  ] = useState('');

  const [
    internalNote,
    setInternalNote,
  ] = useState(false);

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
  ] = useState<
    '' | SupportTicketStatus
  >('');

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState<
    '' | SupportTicketPriority
  >('');

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState<
    '' | SupportTicketCategory
  >('');

  const load =
    async () => {
      try {
        setLoading(
          true,
        );

        const response =
          await AdminSupportApi.list(
            {
              ...(statusFilter
                ? {
                    status:
                      statusFilter,
                  }
                : {}),

              ...(priorityFilter
                ? {
                    priority:
                      priorityFilter,
                  }
                : {}),

              ...(categoryFilter
                ? {
                    category:
                      categoryFilter,
                  }
                : {}),

              limit: 200,
            },
          );

        setTickets(
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
  }, [
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const refreshSelected =
    async (
      id: string,
    ) => {
      const response =
        await AdminSupportApi.get(
          id,
        );

      setSelectedTicket(
        dataOf(response),
      );
    };

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return tickets;
      }

      return tickets.filter(
        (ticket) =>
          [
            ticket.ticketNumber,
            ticket.subject,
            requesterName(
              ticket,
            ),
            ticket.requester
              ?.email,
            ticket.order
              ?.orderNumber,
            ticket.returnRequest
              ?.returnNumber,
            categoryLabels[
              ticket.category
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
      tickets,
      search,
    ]);

  const counts =
    useMemo(
      () => ({
        total:
          tickets.length,

        open:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              'OPEN',
          ).length,

        progress:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              'IN_PROGRESS',
          ).length,

        waiting:
          tickets.filter(
            (ticket) =>
              ticket.status ===
              'WAITING_CUSTOMER',
          ).length,

        urgent:
          tickets.filter(
            (ticket) =>
              ticket.priority ===
              'URGENT',
          ).length,
      }),
      [tickets],
    );

  const run =
    async (
      key: string,
      action: () =>
        Promise<any>,
      message: string,
      ticketId?: string,
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

        if (ticketId) {
          await refreshSelected(
            ticketId,
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

  const handleSendReply =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      if (
        !selectedTicket ||
        !replyText.trim()
      ) {
        return;
      }

      const message =
        replyText.trim();

      await run(
        `reply-${selectedTicket.id}`,

        () =>
          AdminSupportApi.reply(
            selectedTicket.id,
            {
              message,

              isInternal:
                internalNote,
            },
          ),

        internalNote
          ? 'Nota interna registrada.'
          : 'Resposta enviada ao chamado.',

        selectedTicket.id,
      );

      setReplyText('');
      setInternalNote(
        false,
      );
    };

  if (
    loading &&
    !tickets.length
  ) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl min-h-[420px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-purple-600" />

            Central de Suporte
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Chamados reais de clientes com histórico, mensagens, prioridade e acompanhamento administrativo.
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
          label="Em atendimento"
          value={
            counts.progress
          }
        />

        <Metric
          label="Aguardando cliente"
          value={
            counts.waiting
          }
        />

        <Metric
          label="Urgentes"
          value={
            counts.urgent
          }
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid lg:grid-cols-[1fr_auto_auto_auto] gap-3">
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
            placeholder="Chamado, cliente, pedido ou assunto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs"
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
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos os status
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
            priorityFilter
          }
          onChange={(
            event,
          ) =>
            setPriorityFilter(
              event.target
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todas prioridades
          </option>

          {Object.entries(
            priorityLabels,
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
            categoryFilter
          }
          onChange={(
            event,
          ) =>
            setCategoryFilter(
              event.target
                .value as any,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todas categorias
          </option>

          {Object.entries(
            categoryLabels,
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
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />

          <h3 className="font-black mt-3">
            Nenhum chamado encontrado
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Quando clientes abrirem chamados reais, eles aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Chamado
                  </th>

                  <th className="p-3">
                    Cliente
                  </th>

                  <th className="p-3">
                    Assunto
                  </th>

                  <th className="p-3">
                    Categoria
                  </th>

                  <th className="p-3">
                    Prioridade
                  </th>

                  <th className="p-3">
                    Status
                  </th>

                  <th className="p-3">
                    Última atividade
                  </th>

                  <th className="p-3 text-right">
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map(
                  (ticket) => (
                    <tr
                      key={
                        ticket.id
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="p-3 font-mono font-black">
                        {ticket.ticketNumber}
                      </td>

                      <td className="p-3">
                        <strong>
                          {requesterName(
                            ticket,
                          )}
                        </strong>

                        <div className="text-[9px] text-gray-400">
                          {ticket.requester
                            ?.email ||
                            ''}
                        </div>
                      </td>

                      <td className="p-3 max-w-[260px]">
                        <div className="font-bold truncate">
                          {ticket.subject}
                        </div>
                      </td>

                      <td className="p-3">
                        {categoryLabels[
                          ticket.category
                        ] ||
                          ticket.category}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black ${priorityBadge(
                            ticket.priority,
                          )}`}
                        >
                          {priorityLabels[
                            ticket.priority
                          ] ||
                            ticket.priority}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black ${statusBadge(
                            ticket.status,
                          )}`}
                        >
                          {statusLabels[
                            ticket.status
                          ] ||
                            ticket.status}
                        </span>
                      </td>

                      <td className="p-3">
                        {formatDate(
                          ticket.lastMessageAt,
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void refreshSelected(
                              ticket.id,
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

      {selectedTicket && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-50 w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl">
            <div className="sticky top-0 z-10 bg-white border-b rounded-t-3xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-700 font-mono">
                  Chamado #{selectedTicket.ticketNumber}
                </span>

                <h3 className="font-black text-lg text-gray-900">
                  {selectedTicket.subject}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTicket(
                    null,
                  )
                }
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Info
                  label="Cliente"
                  value={
                    requesterName(
                      selectedTicket,
                    )
                  }
                />

                <Info
                  label="Agente"
                  value={
                    agentName(
                      selectedTicket,
                    )
                  }
                />

                <Info
                  label="Categoria"
                  value={
                    categoryLabels[
                      selectedTicket
                        .category
                    ] ||
                    selectedTicket
                      .category
                  }
                />

                <Info
                  label="Status"
                  value={
                    statusLabels[
                      selectedTicket
                        .status
                    ] ||
                    selectedTicket
                      .status
                  }
                />
              </div>

              {(selectedTicket.order ||
                selectedTicket.returnRequest) && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-xs">
                  {selectedTicket.order && (
                    <div>
                      <strong>
                        Pedido:
                      </strong>{' '}
                      {selectedTicket.order
                        .orderNumber ||
                        selectedTicket.order
                          .id}
                    </div>
                  )}

                  {selectedTicket.returnRequest && (
                    <div className="mt-1">
                      <strong>
                        Devolução:
                      </strong>{' '}
                      {
                        selectedTicket
                          .returnRequest
                          .returnNumber
                      }
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white border rounded-2xl p-4">
                <strong className="text-xs">
                  Descrição inicial
                </strong>

                <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">
                  {
                    selectedTicket.description
                  }
                </p>
              </div>

              <div className="bg-white border rounded-2xl p-5">
                <h4 className="font-black text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />

                  Conversa
                </h4>

                <div className="mt-4 max-h-80 overflow-y-auto space-y-3">
                  {selectedTicket.messages?.map(
                    (
                      message: any,
                    ) => {
                      const sender =
                        `${message.sender?.firstName || ''} ${message.sender?.lastName || ''}`.trim() ||
                        message.sender
                          ?.email ||
                        (message.senderType ===
                        'AGENT'
                          ? 'Atendimento Nusali'
                          : 'Cliente');

                      return (
                        <div
                          key={
                            message.id
                          }
                          className={`p-3 rounded-xl border ${
                            message.isInternal
                              ? 'bg-amber-50 border-amber-200'
                              : message.senderType ===
                                  'AGENT'
                                ? 'bg-purple-50 border-purple-100'
                                : 'bg-white border-gray-100'
                          }`}
                        >
                          <div className="flex justify-between gap-3 text-[10px]">
                            <strong className="text-purple-700">
                              {sender}
                            </strong>

                            <div className="flex gap-2">
                              {message.isInternal && (
                                <span className="font-black text-amber-700">
                                  NOTA INTERNA
                                </span>
                              )}

                              <span className="text-gray-400">
                                {formatDate(
                                  message.createdAt,
                                )}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs mt-2 whitespace-pre-wrap">
                            {message.message}
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>

              <form
                onSubmit={
                  handleSendReply
                }
                className="bg-white border rounded-2xl p-5 space-y-3"
              >
                <label className="block font-black text-xs">
                  Responder chamado
                </label>

                <textarea
                  rows={4}
                  required
                  value={
                    replyText
                  }
                  onChange={(
                    event,
                  ) =>
                    setReplyText(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Digite sua resposta..."
                  className="w-full p-3 border rounded-xl text-xs"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <input
                      type="checkbox"
                      checked={
                        internalNote
                      }
                      onChange={(
                        event,
                      ) =>
                        setInternalNote(
                          event.target
                            .checked,
                        )
                      }
                    />

                    Nota interna
                  </label>

                  <button
                    type="submit"
                    disabled={
                      operating ===
                      `reply-${selectedTicket.id}`
                    }
                    className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {operating ===
                    `reply-${selectedTicket.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}

                    {internalNote
                      ? 'Salvar nota'
                      : 'Enviar resposta'}
                  </button>
                </div>
              </form>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white border rounded-2xl p-5">
                  <h4 className="font-black text-sm">
                    Prioridade
                  </h4>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        'LOW',
                        'NORMAL',
                        'HIGH',
                        'URGENT',
                      ] as SupportTicketPriority[]
                    ).map(
                      (
                        priority,
                      ) => (
                        <button
                          key={
                            priority
                          }
                          type="button"
                          onClick={() =>
                            void run(
                              `priority-${priority}`,

                              () =>
                                AdminSupportApi.updatePriority(
                                  selectedTicket.id,
                                  priority,
                                ),

                              'Prioridade atualizada.',

                              selectedTicket.id,
                            )
                          }
                          className={`px-3 py-2 rounded-xl text-xs font-black ${
                            selectedTicket.priority ===
                            priority
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {
                            priorityLabels[
                              priority
                            ]
                          }
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="bg-white border rounded-2xl p-5">
                  <h4 className="font-black text-sm">
                    Estado do atendimento
                  </h4>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTicket.status !==
                      'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            'status-progress',

                            () =>
                              AdminSupportApi.updateStatus(
                                selectedTicket.id,
                                {
                                  status:
                                    'IN_PROGRESS',
                                },
                              ),

                            'Chamado colocado em atendimento.',

                            selectedTicket.id,
                          )
                        }
                        className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-black"
                      >
                        Em atendimento
                      </button>
                    )}

                    {selectedTicket.status !==
                      'WAITING_CUSTOMER' && (
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            'status-wait',

                            () =>
                              AdminSupportApi.updateStatus(
                                selectedTicket.id,
                                {
                                  status:
                                    'WAITING_CUSTOMER',
                                },
                              ),

                            'Chamado aguardando resposta do cliente.',

                            selectedTicket.id,
                          )
                        }
                        className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-black"
                      >
                        Aguardar cliente
                      </button>
                    )}

                    {selectedTicket.status !==
                      'RESOLVED' && (
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            'status-resolved',

                            () =>
                              AdminSupportApi.updateStatus(
                                selectedTicket.id,
                                {
                                  status:
                                    'RESOLVED',
                                },
                              ),

                            'Chamado resolvido.',

                            selectedTicket.id,
                          )
                        }
                        className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black"
                      >
                        Resolver
                      </button>
                    )}

                    {selectedTicket.status !==
                      'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(
                              'Encerrar definitivamente este chamado?',
                            )
                          ) {
                            return;
                          }

                          void run(
                            'status-closed',

                            () =>
                              AdminSupportApi.updateStatus(
                                selectedTicket.id,
                                {
                                  status:
                                    'CLOSED',
                                },
                              ),

                            'Chamado encerrado.',

                            selectedTicket.id,
                          );
                        }}
                        className="px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-black"
                      >
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-5">
                <h4 className="font-black text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />

                  Histórico
                </h4>

                <div className="mt-4 border-l-2 border-purple-200 pl-4 space-y-4">
                  {selectedTicket.history?.map(
                    (
                      history: any,
                    ) => (
                      <div
                        key={
                          history.id
                        }
                      >
                        <div className="text-xs font-black">
                          {statusLabels[
                            history.newStatus
                          ] ||
                            history.newStatus}
                        </div>

                        <div className="text-[10px] text-gray-600 mt-1">
                          {history.reason ||
                            '—'}
                        </div>

                        <div className="text-[9px] text-gray-400 mt-1">
                          {formatDate(
                            history.createdAt,
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {!selectedTicket.assignedTo && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                  <AlertOctagon className="w-5 h-5 text-amber-700 shrink-0" />

                  <div>
                    <strong className="text-xs">
                      Chamado ainda sem agente definido
                    </strong>

                    <p className="text-[10px] text-amber-800 mt-1">
                      Ao enviar a primeira resposta, o backend atribui automaticamente o chamado ao administrador que respondeu.
                    </p>
                  </div>
                </div>
              )}

              {selectedTicket.assignedTo && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                  <User className="w-5 h-5 text-blue-700" />

                  <div>
                    <strong className="text-xs">
                      Responsável atual
                    </strong>

                    <p className="text-xs mt-1">
                      {agentName(
                        selectedTicket,
                      )}
                    </p>
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