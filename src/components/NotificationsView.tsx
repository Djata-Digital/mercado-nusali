import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Package,
  ShieldCheck,
  Tag,
  AlertCircle,
  Check,
  Trash2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { BuyerNavHeader } from './BuyerNavHeader';

export const NotificationsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = usePreferences();
  const [activeFilter, setActiveFilter] = useState<'all' | 'orders' | 'escrow' | 'promos'>('all');


  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      type: 'orders',
      title: 'Seu pedido #NSL-8941203 saiu para entrega!',
      message: 'O entregador da Nusali Express está a caminho do seu endereço em Bissau.',
      time: 'Há 15 minutos',
      isRead: false,
      targetView: 'tracking' as const,
    },
    {
      id: 'notif-2',
      type: 'escrow',
      title: 'Pagamento de $19.000 XOF mantido com Segurança Escrow',
      message: 'O valor está protegido no sistema de retenção até que você confirme o recebimento.',
      time: 'Há 2 horas',
      isRead: false,
      targetView: 'order_detail' as const,
    },
    {
      id: 'notif-3',
      type: 'promos',
      title: 'Cupom de 10% OFF ativado para compras de Eletrônicos!',
      message: 'Use o código NUSALIGLOBAL no seu próximo checkout.',
      time: 'Ontem 18:30',
      isRead: true,
      targetView: 'coupons' as const,
    },
    {
      id: 'notif-4',
      type: 'escrow',
      title: 'Verificação KYC de Vendedor Aprovada',
      message: 'Sua conta está habilitada para operar com todas as moedas e vantagens da plataforma.',
      time: 'Há 3 dias',
      isRead: true,
      targetView: 'profile' as const,
    },
  ]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    showToast('Todas as notificações foram marcadas como lidas!');
  };

  const clearNotifications = () => {
    setNotifications([]);
    showToast('Histórico de notificações limpo.');
  };

  const filtered = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    return n.type === activeFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-900 rounded-xl">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Central de Notificações</h1>
            <p className="text-xs text-gray-500">Acompanhe atualizações de entregas, pagamentos e ofertas em tempo real.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" /> Marcar Lidas
          </button>
          <button
            onClick={clearNotifications}
            className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" /> Limpar
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeFilter === 'all'
              ? 'bg-blue-950 text-white shadow-xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setActiveFilter('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeFilter === 'orders'
              ? 'bg-blue-950 text-white shadow-xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Compras & Entregas
        </button>
        <button
          onClick={() => setActiveFilter('escrow')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeFilter === 'escrow'
              ? 'bg-blue-950 text-white shadow-xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Garantia Escrow
        </button>
        <button
          onClick={() => setActiveFilter('promos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeFilter === 'promos'
              ? 'bg-blue-950 text-white shadow-xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Cupons & Promoções
        </button>
      </div>

      {/* List */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.targetView === 'tracking') navigate('/tracking/NSL-8941203');
                else if (n.targetView === 'order_detail') navigate('/orders/NSL-8941203');
                else navigate('/orders');
              }}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-4 ${
                !n.isRead
                  ? 'bg-blue-50/60 border-blue-200 shadow-2xs hover:border-blue-400'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${!n.isRead ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {n.type === 'orders' && <Package className="w-5 h-5" />}
                  {n.type === 'escrow' && <ShieldCheck className="w-5 h-5" />}
                  {n.type === 'promos' && <Tag className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-bold ${!n.isRead ? 'text-blue-950' : 'text-gray-900'}`}>
                      {n.title}
                    </h3>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 block">{n.time}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">Nenhuma notificação encontrada</h3>
          <p className="text-xs text-gray-500 mt-1">Você está em dia com todas as novidades!</p>
        </div>
      )}
    </div>
  );
};
