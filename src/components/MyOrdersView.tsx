import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock3, Loader2, Package, Truck } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';

const money = (value: string | number, currency = 'XOF') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value || 0));

const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Em preparação',
  READY_TO_SHIP: 'Pronto para envio',
  SHIPPED: 'Enviado',
  IN_TRANSIT: 'Em trânsito',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

export const MyOrdersView: React.FC = () => {
  const navigate = useNavigate();
  const { data: orders = [], isLoading, isError } = useOrders();

  if (isLoading) {
    return <div className="py-20 flex justify-center text-emerald-700"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Package className="w-14 h-14 text-red-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Não foi possível carregar seus pedidos</h2>
        <p className="text-xs text-gray-500 mt-2">Tente novamente após verificar sua sessão.</p>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Package className="w-16 h-16 text-gray-400 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Você ainda não realizou compras</h2>
        <p className="text-xs text-gray-500">Seus pedidos reais aparecerão aqui após o checkout.</p>
        <button onClick={() => navigate('/products')} className="bg-blue-600 text-white font-extrabold px-6 py-2.5 rounded-md text-xs">
          Explorar ofertas
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Minhas Compras ({orders.length})</h1>

      <div className="space-y-4">
        {orders.map((order) => {
          const currency = order.currency?.code || 'XOF';
          return (
            <div key={order.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3">
                <div>
                  <div className="font-black text-gray-900">Pedido {order.orderNumber}</div>
                  <div className="text-gray-500 mt-1">Realizado em {date(order.placedAt || order.createdAt)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-extrabold text-gray-900 text-sm">{money(order.total, currency)}</span>
                  <button onClick={() => navigate(`/orders/${order.id}`)} className="text-blue-600 hover:underline font-bold flex items-center">
                    Ver detalhes <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-md border border-emerald-200">
                  {order.status === 'PENDING_PAYMENT' ? <Clock3 className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                  <span>{statusLabel[order.status] || order.status}</span>
                  <span className="text-gray-500 font-medium">• {order.shippingServiceName}</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {(order.items || []).map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{item.productTitleSnapshot}</h4>
                        <p className="text-[11px] text-gray-500">
                          {item.variantNameSnapshot} • Qtd. {item.quantity} • {money(item.total, currency)}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-500 shrink-0">{order.store?.name || 'Loja'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                <span>Prazo contratado: {order.estimatedDeliveryMinDays}–{order.estimatedDeliveryMaxDays} dias</span>
                <button onClick={() => navigate(`/tracking/${order.id}`)} className="font-bold text-emerald-700 hover:underline">
                  Ver rastreamento
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
