import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  MapPin,
  Lock,
  Wallet,
  Tag,
  Package,
  Star,
  RotateCcw,
  HelpCircle,
  ChevronRight,
  Globe,
  Bell,
  MessageSquare,
  BadgeCheck,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useOrders } from '../hooks/useOrders';
import { useFavorites } from '../hooks/useFavorites';
import { BuyerNavHeader } from './BuyerNavHeader';
import { formatCurrency, countriesConfig } from '../utils/currencyUtils';

export const ProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCountry, selectedCurrency } = usePreferences();
  const { data: orders = [] } = useOrders();
  const { favorites } = useFavorites();

  const currentCountry = countriesConfig[selectedCountry] || countriesConfig.GW;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      {/* User Header Profile Card */}
      <div className="bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-yellow-400 text-blue-950 font-black text-2xl flex items-center justify-center border-4 border-white/20 shadow-lg shrink-0">
              AS
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black">Alex Silva</h1>
                <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-400">
                  <BadgeCheck className="w-3.5 h-3.5" /> COMPRADOR VERIFICADO
                </span>
              </div>

              <p className="text-xs text-gray-200 mt-1 font-mono">alex.silva@nusali.gw • NIF 8941203</p>

              <div className="flex items-center gap-3 mt-3 text-xs text-yellow-300 font-semibold">
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4" /> Operando de: {currentCountry.flag} {currentCountry.name} ({selectedCurrency})
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/security')}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold px-4 py-2 rounded-xl text-xs transition backdrop-blur-xs flex items-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-yellow-300" /> Configurações da Conta
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div
          onClick={() => navigate('/orders')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500">Compras Ativas</span>
            <Package className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <span className="text-2xl font-black text-gray-900">{orders.length}</span>
        </div>

        <div
          onClick={() => navigate('/wallet')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500">Saldo Nusali Pay</span>
            <Wallet className="w-5 h-5 text-blue-600 group-hover:scale-110 transition" />
          </div>
          <span className="text-2xl font-black text-emerald-700">{formatCurrency(45000, selectedCurrency)}</span>
        </div>

        <div
          onClick={() => navigate('/coupons')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500">Cupons Ativos</span>
            <Tag className="w-5 h-5 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <span className="text-2xl font-black text-gray-900">3 Disponíveis</span>
        </div>

        <div
          onClick={() => navigate('/favorites')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500">Favoritos</span>
            <Star className="w-5 h-5 text-amber-500 group-hover:scale-110 transition" />
          </div>
          <span className="text-2xl font-black text-gray-900">{favorites.length}</span>
        </div>
      </div>

      {/* Account Navigation Grid */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Gerenciar Minha Conta</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/addresses')}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Endereços de Entrega</h3>
              <p className="text-xs text-gray-500">Gerenciar locais e dados para envio</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition" />
        </div>

        <div
          onClick={() => navigate('/security')}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Segurança & Senha</h3>
              <p className="text-xs text-gray-500">Autenticação em 2 etapas e sessões</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition" />
        </div>

        <div
          onClick={() => navigate('/wallet')}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Carteira Nusali Pay</h3>
              <p className="text-xs text-gray-500">Cartões, saldos e extrato de cashback</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition" />
        </div>

        <div
          onClick={() => navigate('/returns-refunds')}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-700 rounded-xl group-hover:bg-red-600 group-hover:text-white transition">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Devoluções & Reembolsos</h3>
              <p className="text-xs text-gray-500">Acompanhar solicitações de troca</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition" />
        </div>

        <div
          onClick={() => navigate('/help-center')}
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 text-teal-700 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Central de Ajuda</h3>
              <p className="text-xs text-gray-500">Dúvidas frequentes e suporte 24/7</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition" />
        </div>
      </div>
    </div>
  );
};

