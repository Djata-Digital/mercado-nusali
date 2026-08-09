import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Copy, Loader2, Package, Truck } from 'lucide-react';
import { useOrder, useOrderTracking } from '../hooks/useOrders';

const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export const TrackingView: React.FC = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const order = useOrder(id);
  const tracking = useOrderTracking(id);

  if (order.isLoading || tracking.isLoading) {
    return <div className="py-20 flex justify-center text-emerald-700"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  if (!order.data) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center"><Package className="w-14 h-14 text-gray-300 mx-auto mb-4" /><h2 className="font-bold">Pedido não encontrado.</h2></div>;
  }

  if (!tracking.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Rastreamento ainda não disponível</h2>
        <p className="text-xs text-gray-500 mt-2">
          O pedido {order.data.orderNumber} ainda não possui uma remessa/rastreamento real criado pela operação logística.
        </p>
        <button onClick={() => navigate(`/orders/${id}`)} className="mt-5 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold">
          Voltar ao pedido
        </button>
      </div>
    );
  }

  const data = tracking.data;

  const copy = async () => {
    await navigator.clipboard.writeText(data.trackingNumber);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(`/orders/${id}`)} className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-emerald-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Pedido {order.data.orderNumber}
      </button>

      <div className="bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-yellow-400 text-blue-950 px-3 py-1 rounded-full text-xs font-black uppercase mb-3">
              <Truck className="w-3.5 h-3.5" /> Rastreamento real
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">{data.currentStatus}</h1>
            <p className="text-xs text-gray-200 mt-2">Transportadora: <strong>{data.carrier?.name || 'Não informada'}</strong></p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl border border-white/20 text-xs font-mono">
            <span className="block text-[10px] text-gray-300 font-sans uppercase font-bold">Código real</span>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-bold text-yellow-300 text-sm">{data.trackingNumber}</span>
              <button onClick={() => void copy()} className="p-1.5 bg-white/20 hover:bg-white/30 rounded"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8">
        <div className="flex justify-between gap-4 text-xs border-b pb-4 mb-6">
          <div><span className="text-gray-400 block">Previsão</span><strong>{date(data.estimatedDeliveryAt)}</strong></div>
          <div className="text-right"><span className="text-gray-400 block">Último evento</span><strong>{date(data.lastEventAt)}</strong></div>
        </div>

        <div className="space-y-6 relative pl-6 border-l-2 border-emerald-200 ml-4 py-2">
          {(data.events || []).map((event) => (
            <div key={event.id} className="relative">
              <div className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <h3 className="text-sm font-bold text-gray-900">{event.title}</h3>
                  <span className="text-[11px] text-gray-500">{date(event.eventAt)}</span>
                </div>
                {event.description && <p className="text-xs text-gray-600">{event.description}</p>}
                {(event.city || event.region) && <p className="text-[11px] text-gray-500 mt-1">{[event.city, event.region].filter(Boolean).join(' • ')}</p>}
              </div>
            </div>
          ))}

          {!data.events?.length && (
            <div className="text-xs text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Nenhum evento logístico registrado ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
};
