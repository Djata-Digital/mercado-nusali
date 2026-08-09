import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { useOrder, useOrderTracking } from '../hooks/useOrders';

const money = (value: string | number, currency = 'XOF') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value || 0));

const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export const OrderDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data: order, isLoading, isError } = useOrder(id);
  const tracking = useOrderTracking(id);

  if (isLoading) return <div className="py-20 flex justify-center text-emerald-700"><Loader2 className="w-7 h-7 animate-spin" /></div>;

  if (isError || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <PackageCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Pedido não encontrado ou sem autorização.</h2>
        <button onClick={() => navigate('/orders')} className="mt-5 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold">Minhas compras</button>
      </div>
    );
  }

  const currency = order.currency?.code || 'XOF';
  const address = order.addressSnapshotRelation;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-emerald-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar para Minhas Compras
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-6 flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Pedido {order.orderNumber}</h1>
          <p className="text-xs text-gray-500 mt-1">Criado em {date(order.placedAt || order.createdAt)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">{order.status}</span>
          {tracking.data && (
            <button onClick={() => navigate(`/tracking/${order.id}`)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
              <Truck className="w-4 h-4" /> Rastrear
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-sm font-black mb-4">Itens</h2>
            <div className="divide-y divide-gray-100">
              {(order.items || []).map((item) => (
                <div key={item.id} className="py-4 flex justify-between gap-4 text-xs">
                  <div>
                    <div className="font-bold text-gray-900">{item.productTitleSnapshot}</div>
                    <div className="text-gray-500 mt-1">{item.variantNameSnapshot} • SKU {item.skuSnapshot}</div>
                    <div className="text-gray-500">Quantidade: {item.quantity}</div>
                  </div>
                  <div className="font-black">{money(item.total, currency)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-sm font-black mb-4">Histórico do pedido</h2>
            <div className="space-y-3">
              {(order.timeline || []).length ? (order.timeline || []).map((event) => (
                <div key={event.id} className="border-l-2 border-emerald-300 pl-4 text-xs">
                  <div className="font-bold text-gray-900">{event.title}</div>
                  {event.description && <div className="text-gray-600 mt-1">{event.description}</div>}
                  <div className="text-gray-400 mt-1">{date(event.createdAt)}</div>
                </div>
              )) : <p className="text-xs text-gray-500">Ainda não há eventos adicionais.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-xs space-y-3">
            <h3 className="font-black flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Entrega</h3>
            {address ? (
              <>
                <p className="font-semibold">{address.recipientName}</p>
                <p>{address.street}, {address.number} {address.complement || ''}</p>
                <p>{address.neighborhood ? `${address.neighborhood} • ` : ''}{address.city}, {address.region}</p>
                {address.postalCode && <p>CP/CEP: {address.postalCode}</p>}
                <p>{address.phone}</p>
              </>
            ) : <p className="text-gray-500">Snapshot de endereço indisponível.</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-xs space-y-2">
            <h3 className="font-black flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Valores persistidos</h3>
            <div className="flex justify-between"><span>Subtotal</span><strong>{money(order.subtotal, currency)}</strong></div>
            <div className="flex justify-between"><span>Desconto</span><strong>- {money(order.discountAmount, currency)}</strong></div>
            <div className="flex justify-between"><span>Frete</span><strong>{money(order.shippingAmount, currency)}</strong></div>
            <div className="flex justify-between"><span>Tributos</span><strong>{money(order.estimatedTaxAmount, currency)}</strong></div>
            <div className="flex justify-between border-t pt-2 text-sm"><span>Total</span><strong>{money(order.total, currency)}</strong></div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-xs">
            <h3 className="font-black mb-2">Pagamento</h3>
            <p className="text-gray-600">
              {order.status === 'PENDING_PAYMENT'
                ? 'Aguardando integração/cobrança real do meio de pagamento.'
                : 'O status acima é a fonte oficial persistida do pedido.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
