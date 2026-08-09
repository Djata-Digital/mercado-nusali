import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useOrders } from '../hooks/useOrders';
import { BuyerNavHeader } from './BuyerNavHeader';
import { formatCurrency } from '../utils/currencyUtils';

export const ReturnsRefundsView: React.FC = () => {
  const { showToast, selectedCurrency } = usePreferences();
  const { data: orders = [] } = useOrders();
  const [activeTab, setActiveTab] = useState<'requests' | 'new_request'>('requests');


  const [returnReason, setReturnReason] = useState('defective');
  const [returnDescription, setReturnDescription] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || '');

  const [activeReturns, setActiveReturns] = useState([
    {
      id: 'ret-101',
      orderId: 'NSL-8941203',
      productTitle: 'Fone de Ouvido Bluetooth Anker Soundcore Q30',
      reason: 'Produto com chiado na concha esquerda',
      amount: 19000,
      currency: selectedCurrency,
      status: 'under_review',
      date: 'Há 1 dia',
      trackingLabelCode: 'DEV-GW-98214-NSL',
    },
  ]);

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnDescription.trim()) {
      showToast('Por favor, descreva o motivo da devolução.');
      return;
    }

    const newRet = {
      id: `ret-${Date.now()}`,
      orderId: selectedOrderId,
      productTitle: 'Produto Selecionado',
      reason: returnReason === 'defective' ? 'Defeito de Fabricação' : returnReason === 'wrong_item' ? 'Item Incorreto' : 'Desistência em 7 dias',
      amount: 19000,
      currency: selectedCurrency,
      status: 'under_review' as const,
      date: 'Agora mesmo',
      trackingLabelCode: `DEV-NSL-${Math.floor(10000 + Math.random() * 90000)}`,
    };

    setActiveReturns(prev => [newRet, ...prev]);
    setReturnDescription('');
    setActiveTab('requests');
    showToast('Solicitação de devolução enviada! Etiqueta de frete reverso gerada com sucesso.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-red-100 text-red-800 rounded-xl">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Devoluções & Reembolsos Grátis</h1>
            <p className="text-xs text-gray-500">Solicite trocas, devolução sem custo e acompanhe o estorno na sua Carteira Nusali Pay.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex items-center gap-8 text-sm font-bold">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Minhas Solicitações Ativas ({activeReturns.length})
        </button>
        <button
          onClick={() => setActiveTab('new_request')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'new_request'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" /> Solicitar Nova Devolução
        </button>
      </div>

      {/* Tab 1: Active Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {activeReturns.map((ret) => (
            <div key={ret.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-gray-900">Devolução #{ret.id}</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded border border-amber-200">
                      EM ANÁLISE TÉCNICA
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Pedido Relacionado: #{ret.orderId} • {ret.date}</p>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-base text-gray-900">{formatCurrency(ret.amount, ret.currency)}</span>
                  <span className="text-[10px] text-emerald-700 block font-semibold">Reembolso via Nusali Pay</span>
                </div>
              </div>

              <div className="pt-4 text-xs space-y-2">
                <p className="font-bold text-gray-900">{ret.productTitle}</p>
                <p className="text-gray-600">Motivo: <span className="font-semibold">{ret.reason}</span></p>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Etiqueta de Frete Reverso Gerada</span>
                    <span className="font-mono font-bold text-gray-900">{ret.trackingLabelCode}</span>
                    <p className="text-[11px] text-gray-500 mt-0.5">Leve o produto embalado até o Ponto Nusali Express de Bissau.</p>
                  </div>

                  <button
                    onClick={() => showToast('Iniciando impressão da etiqueta de devolução grátis...')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileText className="w-4 h-4" /> Baixar Etiqueta PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: New Request Form */}
      {activeTab === 'new_request' && (
        <form onSubmit={handleCreateReturn} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4 text-xs">
          <h2 className="text-base font-bold text-gray-900 mb-2">Selecione o pedido para devolução grátis</h2>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Pedido *</label>
            <select
              value={selectedOrderId}
              onChange={e => setSelectedOrderId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden font-medium"
            >
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  Pedido #{o.orderNumber} - Total: {formatCurrency(Number(o.total), o.currency?.code || selectedCurrency)} ({new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(o.placedAt || o.createdAt))})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Motivo Principal *</label>
            <select
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden font-medium"
            >
              <option value="defective">Produto com defeito ou avaria no transporte</option>
              <option value="wrong_item">Recebi produto diferente do anunciado</option>
              <option value="regret">Desistência / Arrependimento em até 7 dias</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Descrição Detalhada e Evidências *</label>
            <textarea
              value={returnDescription}
              onChange={e => setReturnDescription(e.target.value)}
              placeholder="Explique o problema em detalhes para agilizar a liberação da devolução..."
              rows={4}
              required
              className="w-full p-3 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-xs flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Enviar Solicitação & Gerar Etiqueta Grátis
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
