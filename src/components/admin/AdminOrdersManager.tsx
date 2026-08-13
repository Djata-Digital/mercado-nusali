import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';

import {
  OrdersApi,
} from '../../api/clients/OrdersApi';

interface Props {
  showToast: (
    message: string,
  ) => void;
}

const unwrap = (
  response: any,
): any[] => {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
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
  'Não foi possível carregar os pedidos.';

const money = (
  order: any,
) => {
  const amount =
    order.totalAmount ??
    order.total ??
    order.grandTotal ??
    order.priceSnapshotRelation
      ?.grandTotal ??
    0;

  const currency =
    order.currency?.code ||
    order.priceSnapshotRelation
      ?.currencyCode ||
    '';

  return `${amount} ${currency}`.trim();
};

export const AdminOrdersManager:
React.FC<Props> = ({
  showToast,
}) => {
  const [orders, setOrders] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  const [
    selected,
    setSelected,
  ] =
    useState<any | null>(null);

  const load = async () => {
    try {
      setLoading(true);

      const response =
        await OrdersApi.listAdmin();

      setOrders(
        unwrap(response),
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

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return orders;
      }

      return orders.filter(
        (order) => {
          const buyer =
            [
              order.user
                ?.firstName,
              order.user
                ?.lastName,
              order.user?.email,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          const seller =
            [
              order.seller
                ?.tradeName,
              order.seller
                ?.legalName,
              order.store?.name,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          return [
            order.orderNumber,
            order.id,
            buyer,
            seller,
          ].some((value) =>
            String(
              value || '',
            )
              .toLowerCase()
              .includes(term),
          );
        },
      );
    }, [orders, search]);

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-purple-600" />
            Gestão Global de
            Pedidos
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Pedidos reais de todos
            os compradores,
            vendedores e lojas.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="px-4 py-2.5 bg-gray-100 rounded-xl text-xs font-bold flex gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="relative max-w-md">
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
            placeholder="Pedido, comprador, vendedor ou loja..."
            className="w-full pl-9 p-2 border rounded-xl text-xs"
          />
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : !filtered.length ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Nenhum pedido
            encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="p-3 text-left">
                    Pedido
                  </th>

                  <th className="p-3 text-left">
                    Comprador
                  </th>

                  <th className="p-3 text-left">
                    Loja
                  </th>

                  <th className="p-3 text-left">
                    Total
                  </th>

                  <th className="p-3 text-left">
                    Status
                  </th>

                  <th className="p-3 text-right">
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map(
                  (order) => (
                    <tr
                      key={
                        order.id
                      }
                    >
                      <td className="p-3">
                        <strong>
                          {order.orderNumber ||
                            order.id}
                        </strong>

                        <span className="block text-[10px] text-gray-400">
                          {order.createdAt
                            ? new Date(
                                order.createdAt,
                              ).toLocaleString(
                                'pt-BR',
                              )
                            : ''}
                        </span>
                      </td>

                      <td className="p-3">
                        <strong>
                          {[
                            order.user
                              ?.firstName,
                            order.user
                              ?.lastName,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              ' ',
                            ) ||
                            '—'}
                        </strong>

                        <span className="block text-[10px] text-gray-400">
                          {order.user
                            ?.email ||
                            ''}
                        </span>
                      </td>

                      <td className="p-3 font-bold text-purple-700">
                        {order.store
                          ?.name ||
                          '—'}
                      </td>

                      <td className="p-3 font-black text-emerald-700">
                        {money(
                          order,
                        )}
                      </td>

                      <td className="p-3">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] font-black">
                          {order.status}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelected(
                              order,
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

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl p-6">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black">
                Pedido{' '}
                {selected.orderNumber ||
                  selected.id}
              </h3>

              <button
                onClick={() =>
                  setSelected(null)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <Info
                label="Status"
                value={
                  selected.status
                }
              />

              <Info
                label="Loja"
                value={
                  selected.store
                    ?.name ||
                  '—'
                }
              />

              <Info
                label="Total"
                value={money(
                  selected,
                )}
              />

              <Info
                label="Comprador"
                value={[
                  selected.user
                    ?.firstName,
                  selected.user
                    ?.lastName,
                ]
                  .filter(Boolean)
                  .join(' ') ||
                  '—'}
              />

              <Info
                label="Criado em"
                value={
                  selected.createdAt
                    ? new Date(
                        selected.createdAt,
                      ).toLocaleString(
                        'pt-BR',
                      )
                    : '—'
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

    <strong>
      {value}
    </strong>
  </div>
);