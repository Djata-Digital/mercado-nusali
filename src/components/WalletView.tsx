import React, { useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  CreditCard,
  PlusCircle,
  ShieldCheck,
  History,
  DollarSign,
  Smartphone,
  Globe,
  Sparkles,
  Download,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { BuyerNavHeader } from './BuyerNavHeader';
import { formatCurrency, countriesConfig } from '../utils/currencyUtils';

export const WalletView: React.FC = () => {
  const { selectedCurrency, selectedCountry, showToast } = usePreferences();


  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'purchases' | 'cashback'>('all');
  const [balance, setBalance] = useState(45000); // 45.000 XOF
  const [cashbackBalance, setCashbackBalance] = useState(3200);

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('10000');
  const [depositMethod, setDepositMethod] = useState<'orange_money' | 'mtn' | 'pix' | 'mb_way' | 'card'>('orange_money');

  const [transactions, setTransactions] = useState([
    {
      id: 'tx-101',
      type: 'purchase',
      title: 'Compra de Smartphone Samsung Galaxy A55',
      amount: -19000,
      currency: selectedCurrency,
      date: 'Hoje 14:20',
      status: 'Escrow Retido',
      method: 'Orange Money',
    },
    {
      id: 'tx-102',
      type: 'cashback',
      title: 'Cashback Nusali+ Recebido',
      amount: +1200,
      currency: selectedCurrency,
      date: 'Ontem',
      status: 'Acreditado',
      method: 'Programa Nusali+',
    },
    {
      id: 'tx-103',
      type: 'deposit',
      title: 'Recarga de Saldo Nusali Pay',
      amount: +50000,
      currency: selectedCurrency,
      date: 'Há 3 dias',
      status: 'Concluído',
      method: 'Depósito Local',
    },
  ]);

  const handleExecuteDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(depositAmount);
    if (!val || val <= 0) return;

    setBalance(prev => prev + val);

    const newTx = {
      id: `tx-${Date.now()}`,
      type: 'deposit' as const,
      title: `Depósito Nusali Pay (${depositMethod.toUpperCase().replace('_', ' ')})`,
      amount: val,
      currency: selectedCurrency,
      date: 'Agora mesmo',
      status: 'Concluído',
      method: depositMethod.toUpperCase(),
    };

    setTransactions(prev => [newTx, ...prev]);
    setIsDepositModalOpen(false);
    showToast(`Depósito de ${formatCurrency(val, selectedCurrency)} adicionado com sucesso!`);
  };

  const currentCountry = countriesConfig[selectedCountry] || countriesConfig.GW;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      {/* Main Wallet Hero Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-yellow-400 text-blue-950 px-3 py-1 rounded-full text-xs font-black uppercase mb-3">
              <Wallet className="w-3.5 h-3.5" /> Nusali Pay - Carteira Internacional
            </div>
            <p className="text-xs text-gray-200">Saldo Disponível em {currentCountry.flag} {currentCountry.name}</p>
            <h1 className="text-3xl sm:text-4xl font-black text-yellow-300 tracking-tight mt-1">
              {formatCurrency(balance, selectedCurrency)}
            </h1>

            <div className="flex items-center gap-4 mt-4 text-xs font-semibold text-emerald-200">
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg border border-white/20">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                Cashback Nusali+: {formatCurrency(cashbackBalance, selectedCurrency)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="flex-1 md:flex-none bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black px-5 py-3 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" /> Adicionar Saldo
            </button>
            <button
              onClick={() => showToast('Iniciando transferência / resgate para conta bancária ou Mobile Money...')}
              className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold px-5 py-3 rounded-xl text-xs transition backdrop-blur-xs flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4 text-yellow-300" /> Transferir / Saque
            </button>
          </div>
        </div>
      </div>

      {/* Methods Support Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
          Formas de Pagamento e Carregamento Suportadas no Seu País ({currentCountry.name})
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold text-gray-800">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-700" />
            <span>Orange Money & MTN</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-700" />
            <span>PIX & MB WAY</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-700" />
            <span>Cartões Visa / Mastercard</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span>Proteção Escrow Nusali</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-900" /> Extrato do Nusali Pay
          </h2>

          <button
            onClick={() => showToast('Download do extrato financeiro concluído.')}
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
          >
            <Download className="w-4 h-4" /> Baixar Extrato
          </button>
        </div>

        <div className="space-y-4">
          {transactions.map((tx) => {
            const isPositive = tx.amount > 0;
            return (
              <div key={tx.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-900'}`}>
                    {isPositive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-gray-900">{tx.title}</h3>
                    <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                      {tx.method} • {tx.date} • Status: <span className="font-bold text-emerald-700">{tx.status}</span>
                    </span>
                  </div>
                </div>

                <div className={`text-sm font-black ${isPositive ? 'text-emerald-700' : 'text-gray-900'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deposit Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <form onSubmit={handleExecuteDeposit} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Adicionar Saldo no Nusali Pay</h2>
            <p className="text-xs text-gray-500 mb-6">Escolha o método de pagamento local para recarregar instantaneamente.</p>

            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-gray-700 mb-1">Valor da Recarga ({selectedCurrency}) *</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="Ex: 10000"
                  required
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Método de Recarga *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositMethod('orange_money')}
                    className={`p-3 border rounded-xl font-bold text-left transition ${
                      depositMethod === 'orange_money' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200'
                    }`}
                  >
                    <span>🍊 Orange Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositMethod('mtn')}
                    className={`p-3 border rounded-xl font-bold text-left transition ${
                      depositMethod === 'mtn' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200'
                    }`}
                  >
                    <span>🟡 MTN Mobile Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositMethod('pix')}
                    className={`p-3 border rounded-xl font-bold text-left transition ${
                      depositMethod === 'pix' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200'
                    }`}
                  >
                    <span>💚 PIX Brasil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepositMethod('mb_way')}
                    className={`p-3 border rounded-xl font-bold text-left transition ${
                      depositMethod === 'mb_way' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200'
                    }`}
                  >
                    <span>🔴 MB WAY Portugal</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-xs"
              >
                Confirmar Recarga Instantânea
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
