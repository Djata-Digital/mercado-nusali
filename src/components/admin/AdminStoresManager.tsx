import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Ban,
  Building2,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  X,
} from 'lucide-react';

import {
  StoreReal,
  StoresApi,
} from '../../api/clients/StoresApi';

interface Props {
  showToast: (
    message: string,
  ) => void;
}

const unwrap = (
  response: any,
): StoreReal[] => {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
};

const getErrorMessage = (
  error: any,
) =>
  error?.response?.data?.error
    ?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const statusLabel = (
  status?: string,
) => {
  switch (status) {
    case 'ACTIVE':
      return 'Ativa';

    case 'SUSPENDED':
      return 'Suspensa';

    case 'CLOSED':
      return 'Fechada';

    case 'PENDING':
      return 'Pendente';

    default:
      return status || '-';
  }
};

export const AdminStoresManager:
React.FC<Props> = ({
  showToast,
}) => {
  const [
    stores,
    setStores,
  ] = useState<StoreReal[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('');

  const [
    selectedStore,
    setSelectedStore,
  ] =
    useState<any | null>(null);

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState<string | null>(
      null,
    );

  const loadStores =
    async () => {
      try {
        setLoading(true);

        const response =
          await StoresApi.listAdmin(
            {
              page: 1,
              limit: 100,

              status:
                statusFilter ||
                undefined,

              search:
                search.trim() ||
                undefined,
            },
          );

        setStores(
          unwrap(response),
        );
      } catch (
        error: any
      ) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadStores();
  }, [statusFilter]);

  const filtered =
    useMemo(() => {
      if (!search.trim()) {
        return stores;
      }

      const term =
        search
          .trim()
          .toLowerCase();

      return stores.filter(
        (store: any) => {
          const sellerName =
            [
              store.seller
                ?.tradeName,
              store.seller
                ?.legalName,
              store.seller?.user
                ?.firstName,
              store.seller?.user
                ?.lastName,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          return (
            store.name
              ?.toLowerCase()
              .includes(term) ||
            store.slug
              ?.toLowerCase()
              .includes(term) ||
            sellerName.includes(
              term,
            )
          );
        },
      );
    }, [stores, search]);

  const changeStatus =
    async (
      store: StoreReal,
      status: string,
    ) => {
      try {
        setActionLoading(
          store.id,
        );

        const response =
          await StoresApi.updateAdminStatus(
            store.id,
            {
              status,
            },
          );

        if (
          !response.success
        ) {
          throw new Error(
            response.error
              ?.message ||
              'Falha ao atualizar loja.',
          );
        }

        showToast(
          `Status da loja "${store.name}" atualizado.`,
        );

        await loadStores();
      } catch (
        error: any
      ) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setActionLoading(
          null,
        );
      }
    };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            Gestão de Lojas
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Supervisão real das
            lojas cadastradas no
            marketplace.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadStores()
          }
          className="px-4 py-2.5 bg-gray-100 rounded-xl text-xs font-bold flex gap-2 items-center"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          <input
            value={search}
            onChange={(
              event,
            ) =>
              setSearch(
                event.target
                  .value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                'Enter'
              ) {
                void loadStores();
              }
            }}
            placeholder="Buscar loja, slug ou vendedor..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs"
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
                .value,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos os status
          </option>

          <option value="ACTIVE">
            Ativas
          </option>

          <option value="SUSPENDED">
            Suspensas
          </option>

          <option value="CLOSED">
            Fechadas
          </option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white border rounded-2xl p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : !filtered.length ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-sm text-gray-500">
          Nenhuma loja encontrada.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(
            (store: any) => {
              const sellerName =
                store.seller
                  ?.tradeName ||
                store.seller
                  ?.legalName ||
                [
                  store.seller
                    ?.user
                    ?.firstName,
                  store.seller
                    ?.user
                    ?.lastName,
                ]
                  .filter(Boolean)
                  .join(' ') ||
                '—';

              const busy =
                actionLoading ===
                store.id;

              return (
                <div
                  key={store.id}
                  className="bg-white border rounded-2xl p-5 space-y-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {store.country
                          ?.code ||
                          '—'}
                      </span>

                      <h3 className="font-black mt-1">
                        {store.name}
                      </h3>

                      <p className="text-xs text-purple-700 font-bold mt-1">
                        {sellerName}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2 py-1 h-fit rounded-full ${
                        store.status ===
                        'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : store.status ===
                              'SUSPENDED'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabel(
                        store.status,
                      )}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        Slug
                      </span>

                      <strong>
                        {store.slug}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        Avaliação
                      </span>

                      <strong>
                        {Number(
                          store.averageRating ||
                            0,
                        ).toFixed(
                          1,
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        Oficial
                      </span>

                      <strong>
                        {store.isOfficial
                          ? 'Sim'
                          : 'Não'}
                      </strong>
                    </div>
                  </div>

                  <div className="border-t pt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStore(
                          store,
                        )
                      }
                      className="px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detalhes
                    </button>

                    {store.status !==
                      'ACTIVE' && (
                      <button
                        disabled={
                          busy
                        }
                        type="button"
                        onClick={() =>
                          void changeStatus(
                            store,
                            'ACTIVE',
                          )
                        }
                        className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ativar
                      </button>
                    )}

                    {store.status ===
                      'ACTIVE' && (
                      <button
                        disabled={
                          busy
                        }
                        type="button"
                        onClick={() =>
                          void changeStatus(
                            store,
                            'SUSPENDED',
                          )
                        }
                        className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold flex gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Suspender
                      </button>
                    )}

                    {store.status !==
                      'CLOSED' && (
                      <button
                        disabled={
                          busy
                        }
                        type="button"
                        onClick={() =>
                          void changeStatus(
                            store,
                            'CLOSED',
                          )
                        }
                        className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-bold flex gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Fechar
                      </button>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {selectedStore && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black flex gap-2">
                <Store className="w-5 h-5 text-purple-600" />
                Detalhes da Loja
              </h3>

              <button
                onClick={() =>
                  setSelectedStore(
                    null,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-xs space-y-3">
              <Info
                label="Nome"
                value={
                  selectedStore.name
                }
              />

              <Info
                label="Slug"
                value={
                  selectedStore.slug
                }
              />

              <Info
                label="Status"
                value={statusLabel(
                  selectedStore.status,
                )}
              />

              <Info
                label="País"
                value={
                  selectedStore
                    .country?.name ||
                  selectedStore
                    .country?.code ||
                  '—'
                }
              />

              <Info
                label="E-mail"
                value={
                  selectedStore
                    .businessEmail ||
                  '—'
                }
              />

              <Info
                label="Telefone"
                value={
                  selectedStore
                    .businessPhone ||
                  '—'
                }
              />

              <Info
                label="Cidade"
                value={
                  selectedStore.city ||
                  '—'
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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