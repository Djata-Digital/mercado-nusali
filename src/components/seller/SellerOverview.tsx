import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Lock,
  Wallet,
  ShoppingBag,
  Package,
  AlertTriangle,
  RotateCcw,
  Star,
  Users,
  Eye,
  MessageSquare,
  HelpCircle,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  BadgeCheck,
  Building2,
  Globe,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { CurrencyCode, CountryCode } from '../../types';
import { formatCurrency, countriesConfig } from '../../utils/currencyUtils';

interface SellerOverviewProps {
  selectedCurrency: CurrencyCode;
  selectedStoreName: string;
  onNavigateSection: (section: any) => void;
}

export const SellerOverview: React.FC<SellerOverviewProps> = ({
  selectedCurrency,
  selectedStoreName,
  onNavigateSection,
}) => {
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | '90days' | 'custom'>('30days');

  // Multiplier for chart & stats simulation based on period
  const mult = period === 'today' ? 0.08 : period === '7days' ? 0.28 : period === '30days' ? 1.0 : period === '90days' ? 2.8 : 1.5;

  const grossRevenue = 14850000 * mult; // 14.850.000 XOF
  const netRevenue = 14107500 * mult;
  const availableBalance = 6850000;
  const escrowBalance = 4200000;
  const pendingRelease = 3800000;

  // Chart datasets
  const salesHistory = [
    { label: 'Semana 1', vendas: Math.round(18 * mult), receita: Math.round(2800000 * mult) },
    { label: 'Semana 2', vendas: Math.round(24 * mult), receita: Math.round(3900000 * mult) },
    { label: 'Semana 3', vendas: Math.round(32 * mult), receita: Math.round(4850000 * mult) },
    { label: 'Semana 4', vendas: Math.round(28 * mult), receita: Math.round(3300000 * mult) },
  ];

  const currencyDistribution = [
    { name: 'XOF (Franco CFA)', value: 65, color: '#059669' },
    { name: 'EUR (Euro)', value: 20, color: '#2563eb' },
    { name: 'BRL (Real)', value: 10, color: '#16a34a' },
    { name: 'USD (Dólar)', value: 5, color: '#d97706' },
  ];

  const countryOrders = [
    { country: '🇬🇼 Guiné-Bissau', pedidos: Math.round(62 * mult), valor: formatCurrency(8200000 * mult, selectedCurrency) },
    { country: '🇵🇹 Portugal', pedidos: Math.round(22 * mult), valor: formatCurrency(3500000 * mult, selectedCurrency) },
    { country: '🇧🇷 Brasil', pedidos: Math.round(12 * mult), valor: formatCurrency(1900000 * mult, selectedCurrency) },
    { country: '🇦🇴 Angola', pedidos: Math.round(6 * mult), valor: formatCurrency(1250000 * mult, selectedCurrency) },
  ];

  const topSellingProducts = [
    { title: 'Smartphone Samsung Galaxy A55 5G 256GB', sales: 42, rev: 7980000 },
    { title: 'Castanha de Caju Torrada Orgânica 1kg', sales: 110, rev: 1320000 },
    { title: 'Fone de Ouvido Bluetooth Anker Q30', sales: 38, rev: 722000 },
    { title: 'Carregador Anker Fast Charge 65W GaN', sales: 65, rev: 975000 },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header & Period Selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">Visão Geral da Operação</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-700" /> VENDEDOR PLATINUM
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Acompanhe suas vendas locais e internacionais na loja <span className="font-bold text-gray-900">{selectedStoreName}</span>.
          </p>
        </div>

        {/* Period Selector Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold w-full md:w-auto overflow-x-auto">
          {(['today', '7days', '30days', '90days'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg transition whitespace-nowrap ${
                period === p ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p === 'today' ? 'Hoje' : p === '7days' ? '7 dias' : p === '30days' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Financial & Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateSection('sales')}
          className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-6 rounded-2xl shadow-md cursor-pointer hover:scale-[1.01] transition"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-200 uppercase">Receita Bruta</span>
            <div className="p-2 bg-white/10 rounded-xl text-yellow-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white">{formatCurrency(grossRevenue, selectedCurrency)}</h2>
          <span className="text-[11px] text-emerald-300 mt-2 block font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-yellow-300" /> Receita Líquida: {formatCurrency(netRevenue, selectedCurrency)}
          </span>
        </div>

        <div
          onClick={() => onNavigateSection('financial')}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase">Saldo Disponível</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-emerald-700">{formatCurrency(availableBalance, selectedCurrency)}</h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateSection('payouts');
            }}
            className="mt-2 text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
          >
            Solicitar Saque Instantâneo <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          onClick={() => onNavigateSection('financial')}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase">Retido em Escrow</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-blue-900">{formatCurrency(escrowBalance, selectedCurrency)}</h2>
          <span className="text-[11px] text-gray-500 mt-2 block font-semibold">
            Proteção garantida até a entrega do pedido
          </span>
        </div>

        <div
          onClick={() => onNavigateSection('orders')}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase">Aguardando Liberação</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-amber-700">{formatCurrency(pendingRelease, selectedCurrency)}</h2>
          <span className="text-[11px] text-gray-500 mt-2 block font-semibold">
            Liberação prevista em 24h a 48h
          </span>
        </div>
      </div>

      {/* Orders Status Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-700" /> Status Operacional de Pedidos
          </h2>
          <button
            onClick={() => onNavigateSection('orders')}
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
          >
            Ver Todos os Pedidos <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">{Math.round(4 * mult)}</span>
            <span className="text-[11px] font-bold text-amber-600 block">Pendentes</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">{Math.round(18 * mult)}</span>
            <span className="text-[11px] font-bold text-emerald-600 block">Pagos</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">{Math.round(6 * mult)}</span>
            <span className="text-[11px] font-bold text-blue-600 block">Preparação</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">{Math.round(12 * mult)}</span>
            <span className="text-[11px] font-bold text-purple-600 block">Enviados</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">{Math.round(58 * mult)}</span>
            <span className="text-[11px] font-bold text-teal-600 block">Entregues</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">1</span>
            <span className="text-[11px] font-bold text-red-600 block">Devoluções</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-lg font-black text-gray-900 block">0</span>
            <span className="text-[11px] font-bold text-red-700 block">Disputas</span>
          </div>
        </div>
      </div>

      {/* Recharts Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Trend Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" /> Desempenho de Vendas por Período
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(val, selectedCurrency), 'Receita']}
                />
                <Area type="monotone" dataKey="receita" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency & International Orders Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-700" /> Vendas por País do Comprador
          </h3>
          <div className="space-y-4">
            {countryOrders.map((co, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs font-bold">
                <span className="text-gray-900">{co.country}</span>
                <div className="text-right">
                  <span className="text-gray-900 block">{co.valor}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{co.pedidos} pedidos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Conversion Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 block uppercase">Avaliação Média</span>
          <span className="text-xl font-black text-amber-500 flex items-center gap-1 mt-1">
            4.95 <Star className="w-4 h-4 fill-amber-500" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 block uppercase">Seguidores</span>
          <span className="text-xl font-black text-gray-900 mt-1 block">3.840</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 block uppercase">Taxa de Conversão</span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">4.2%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 block uppercase">Visitas Únicas</span>
          <span className="text-xl font-black text-gray-900 mt-1 block">18.420</span>
        </div>

        <div
          onClick={() => onNavigateSection('questions')}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs cursor-pointer hover:border-emerald-500"
        >
          <span className="text-[10px] font-bold text-gray-400 block uppercase">Perguntas Pendentes</span>
          <span className="text-xl font-black text-amber-600 mt-1 block">1</span>
        </div>

        <div
          onClick={() => onNavigateSection('messages')}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs cursor-pointer hover:border-emerald-500"
        >
          <span className="text-[10px] font-bold text-gray-400 block uppercase">Mensagens SAC</span>
          <span className="text-xl font-black text-blue-600 mt-1 block">2</span>
        </div>
      </div>
    </div>
  );
};
