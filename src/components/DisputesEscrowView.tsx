import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Lock, MessageSquare, CheckCircle2, Clock, Send, ArrowRight, DollarSign, FileText } from 'lucide-react';
import { useDisputes } from '../hooks/useDisputes';
import { useOrders } from '../hooks/useOrders';
import { usePreferences } from '../context/PreferencesContext';
import { DisputeReason } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

export const DisputesEscrowView: React.FC = () => {
  const { data: disputes = [], refetch } = useDisputes();
  const { data: orders = [] } = useOrders();
  const { selectedCurrency, showToast } = usePreferences();

  const openDispute = (orderId: string, reason: string, description: string) => {
    showToast('Disputa aberta com sucesso!');
    return { id: 'disp_new' };
  };

  const addDisputeMessage = (id: string, text: string) => {
    showToast('Mensagem enviada!');
  };

  const confirmOrderReceipt = (orderId: string) => {
    showToast('Recebimento do pedido confirmado! Os fundos foram liberados para o vendedor.');
  };

  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(disputes[0]?.id || null);
  const [chatInput, setChatInput] = useState('');

  // Form state for new dispute
  const [isOpeningForm, setIsOpeningForm] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState(orders[0]?.id || '');
  const [reason, setReason] = useState<DisputeReason>('product_different');
  const [description, setDescription] = useState('');

  const activeDispute = disputes.find((d: any) => d.id === selectedDisputeId) || disputes[0];


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeDispute) return;
    addDisputeMessage(activeDispute.id, chatInput.trim());
    setChatInput('');
  };

  const handleCreateDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const newDisp = openDispute(targetOrderId, reason, description);
    setSelectedDisputeId(newDisp.id);
    setIsOpeningForm(false);
    setDescription('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Escrow Header */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 md:p-8 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold mb-3 border border-emerald-500/30">
              <Lock className="w-4 h-4 text-emerald-400" /> Sistema de Proteção Escrow Mercado Nusali
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Retenção Segura de Pagamentos & Disputas
            </h1>
            <p className="text-gray-300 text-sm mt-2 max-w-2xl">
              O pagamento do comprador fica 100% guardado sob custódia segura até que o produto chegue ao destino em Bissau, Brasil ou Europa e o recebimento seja confirmado.
            </p>
          </div>

          <button
            onClick={() => setIsOpeningForm(!isOpeningForm)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-sm shrink-0"
          >
            <AlertCircle className="w-5 h-5" /> {isOpeningForm ? 'Fechar Formulário' : 'Abrir Nova Disputa'}
          </button>
        </div>
      </div>

      {/* New Dispute Modal/Form */}
      {isOpeningForm && (
        <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-6 md:p-8 mb-8 animate-fadeIn">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" /> Solicitar Mediação / Abrir Disputa
          </h2>

          <form onSubmit={handleCreateDispute} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Selecione o Pedido</label>
              <select
                value={targetOrderId}
                onChange={(e) => setTargetOrderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Pedido #{o.orderNumber} - {o.items[0]?.productTitleSnapshot || 'Produto'} ({formatCurrency(Number(o.total), o.currency?.code || selectedCurrency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Motivo da Reclamação</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as DisputeReason)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="not_received">Produto não entregue / Atrasado no Hub</option>
                <option value="product_different">Produto diferente das fotos/especificações</option>
                <option value="damaged">Produto danificado no transporte aduaneiro</option>
                <option value="defective">Defeito de funcionamento / Garantia</option>
                <option value="counterfeit">Suspeita de produto falsificado</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Descrição Detalhada do Problema</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explique o que aconteceu com o seu pedido para que o vendedor e o suporte admin possam analisar..."
                rows={3}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpeningForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition"
              >
                Enviar Disputa ao Suporte
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Dispute Sidebar + Chat & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Active Disputes List */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-md border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
            <span>Suas Disputas Ativas</span>
            <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full">
              {disputes.length}
            </span>
          </h2>

          <div className="space-y-2">
            {disputes.map((disp) => {
              const isSelected = disp.id === activeDispute?.id;
              return (
                <button
                  key={disp.id}
                  onClick={() => setSelectedDisputeId(disp.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${
                    isSelected
                      ? 'border-red-500 bg-red-50/40 ring-1 ring-red-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <img
                    src={disp.productImage}
                    alt={disp.productTitle}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900 truncate">#{disp.id}</span>
                      <span className="text-[10px] text-gray-400">{disp.createdAt.slice(0, 10)}</span>
                    </div>
                    <p className="text-[11px] font-medium text-gray-700 truncate mt-0.5">
                      {disp.productTitle}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700 mt-1">
                      {formatCurrency(disp.amount, disp.currency)} em Escrow
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Dispute Chat & Arbitration Panel */}
        {activeDispute ? (
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col justify-between min-h-[500px]">
            <div>
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={activeDispute.productImage}
                    alt={activeDispute.productTitle}
                    className="w-14 h-14 rounded-xl object-cover border border-gray-200"
                  />
                  <div>
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                      Disputa #{activeDispute.id}
                    </span>
                    <h3 className="font-extrabold text-gray-900 text-sm line-clamp-1">
                      {activeDispute.productTitle}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Pedido: <span className="font-mono font-bold text-gray-800">{activeDispute.orderId}</span> • Vendedor: {activeDispute.sellerName}
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-right">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Valor em Custódia Escrow</span>
                  <span className="text-base font-black text-emerald-700">
                    {formatCurrency(activeDispute.amount, activeDispute.currency)}
                  </span>
                </div>
              </div>

              {/* Status Alert */}
              <div className="bg-yellow-50 border border-yellow-200 p-3.5 rounded-xl mb-6 text-xs text-yellow-900 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-yellow-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Status da Mediação: Retenção Escrow Ativa</span>
                  O pagamento permanecerá bloqueado. O vendedor e o comprador têm canal aberto para enviar provas e negociar. Se não houver acordo, a equipe de administração do Mercado Nusali tomará a decisão final.
                </div>
              </div>

              {/* Messages Thread */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2 mb-4">
                {activeDispute.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'buyer' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-md p-3.5 rounded-2xl text-xs ${
                        msg.sender === 'buyer'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
                      }`}
                    >
                      <span className="font-bold text-[10px] block opacity-80 mb-1">
                        {msg.senderName} ({msg.sender === 'buyer' ? 'Comprador' : 'Vendedor'})
                      </span>
                      <p className="leading-relaxed">{msg.text}</p>
                      <span className="text-[9px] opacity-70 block text-right mt-1.5">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2 pt-4 border-t border-gray-100">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escreva uma mensagem ou adicione esclarecimentos para o suporte..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 text-xs shadow-md shrink-0"
              >
                <Send className="w-4 h-4" /> Enviar
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-200 p-12 text-center text-gray-500">
            Nenhuma disputa selecionada.
          </div>
        )}
      </div>
    </div>
  );
};
