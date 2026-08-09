import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Gift,
  CheckCircle2,
  Copy,
  Clock,
  Sparkles,
  ArrowRight,
  Percent,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { BuyerNavHeader } from './BuyerNavHeader';

export const CouponsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = usePreferences();
  const [promoInput, setPromoInput] = useState('');


  const [coupons, setCoupons] = useState([
    {
      id: 'cup-1',
      code: 'NUSALIGLOBAL',
      discount: '10% OFF',
      description: 'Válido para produtos de Eletrônicos em Guiné-Bissau e envios internacionais.',
      validUntil: '31/12/2026',
      isClaimed: true,
    },
    {
      id: 'cup-2',
      code: 'FRETEGRATIS',
      discount: 'FRETE GRÁTIS',
      description: 'Isenção total na taxa de entrega do seu primeiro pedido com Nusali Express.',
      validUntil: '15/09/2026',
      isClaimed: false,
    },
    {
      id: 'cup-3',
      code: 'NUSALIPLUS',
      discount: '15% CASHBACK',
      description: 'Acumule cashback direto na sua carteira Nusali Pay.',
      validUntil: '30/11/2026',
      isClaimed: false,
    },
  ]);

  const handleApplyPromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;

    showToast(`Cupom "${promoInput.toUpperCase()}" aplicado com sucesso no seu próximo checkout!`);
    setPromoInput('');
  };

  const handleClaimCoupon = (id: string, code: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, isClaimed: true } : c));
    navigator.clipboard.writeText(code);
    showToast(`Cupom ${code} resgatado e código copiado!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-900 rounded-xl">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Cupons de Desconto & Cashback</h1>
              <p className="text-xs text-gray-500">Resgaste cupons promocionais para economizar nas suas compras no Mercado Nusali.</p>
            </div>
          </div>

          <form onSubmit={handleApplyPromoCode} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={promoInput}
              onChange={e => setPromoInput(e.target.value)}
              placeholder="Digite o código do cupom..."
              className="py-2.5 px-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold uppercase focus:outline-hidden focus:border-purple-600"
            />
            <button
              type="submit"
              className="bg-purple-900 hover:bg-purple-950 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-xs whitespace-nowrap"
            >
              Aplicar
            </button>
          </form>
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {coupons.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="bg-purple-100 text-purple-900 font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 border border-purple-200">
                  <Percent className="w-3.5 h-3.5" /> {c.discount}
                </span>
                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Validade: {c.validUntil}
                </span>
              </div>

              <h3 className="font-mono font-black text-lg text-gray-900 tracking-wider mb-2">{c.code}</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-6">{c.description}</p>
            </div>

            <button
              onClick={() => handleClaimCoupon(c.id, c.code)}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                c.isClaimed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-purple-900 hover:bg-purple-950 text-white shadow-xs'
              }`}
            >
              {c.isClaimed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Resgatado (Copiar Código)</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>Resgatar Cupom</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
