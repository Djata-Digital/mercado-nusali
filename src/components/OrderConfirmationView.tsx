import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Loader2, PackageCheck } from 'lucide-react';
import { useOrder } from '../hooks/useOrders';

const money = (value: string | number, currency = 'XOF') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value || 0));

export const OrderConfirmationView: React.FC = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data: order, isLoading, isError } = useOrder(id);

  if (isLoading) return <div className="py-20 flex justify-center text-emerald-700"><Loader2 className="w-7 h-7 animate-spin" /></div>;

  if (isError || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <PackageCheck className="w-14 h-14 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Não foi possível carregar a confirmação do pedido.</h2>
        <button onClick={() => navigate('/orders')} className="mt-5 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold">Minhas compras</button>
      </div>
    );
  }

  const currency = order.currency?.code || 'XOF';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xs text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-gray-900">Pedido criado com sucesso</h1>
        <p className="text-xs text-gray-500 mt-2">Pedido {order.orderNumber}</p>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 flex gap-3">
          <Clock3 className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-black">Status: {order.status}</div>
            <p className="mt-1">
              Nenhum pagamento é simulado. Enquanto os provedores reais não estiverem integrados,
              este pedido permanece aguardando pagamento.
            </p>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-3 text-xs text-left">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-gray-500">Total persistido</div>
            <div className="text-lg font-black text-gray-900 mt-1">{money(order.total, currency)}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-gray-500">Entrega contratada</div>
            <div className="font-black text-gray-900 mt-1">{order.shippingServiceName}</div>
            <div className="text-gray-500 mt-1">{order.estimatedDeliveryMinDays}–{order.estimatedDeliveryMaxDays} dias</div>
          </div>
        </div>

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate(`/orders/${order.id}`)} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
            Ver detalhes <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/orders')} className="bg-gray-100 text-gray-800 px-6 py-2.5 rounded-xl text-xs font-bold">
            Minhas compras
          </button>
        </div>
      </div>
    </div>
  );
};
