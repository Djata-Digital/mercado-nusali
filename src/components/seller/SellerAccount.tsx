import React, { useState } from 'react';
import {
  UserCheck,
  Building2,
  FileText,
  CreditCard,
  MapPin,
  Globe,
  Phone,
  Mail,
  Lock,
  BadgeCheck,
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
  Save,
} from 'lucide-react';
import { SellerProfileData } from '../../data/mockSellerData';
import { CountryCode, CurrencyCode } from '../../types';
import { countriesConfig } from '../../utils/currencyUtils';

interface SellerAccountProps {
  profile: SellerProfileData;
  onUpdateProfile: (p: SellerProfileData) => void;
  showToast: (msg: string) => void;
  onNavigateSection: (sec: any) => void;
}

export const SellerAccount: React.FC<SellerAccountProps> = ({
  profile,
  onUpdateProfile,
  showToast,
  onNavigateSection,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [commercialName, setCommercialName] = useState(profile.commercialName);
  const [sellerType, setSellerType] = useState(profile.sellerType);
  const [taxId, setTaxId] = useState(profile.taxId);
  const [country, setCountry] = useState<CountryCode>(profile.country);
  const [city, setCity] = useState(profile.city);
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(profile.preferredCurrency);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      fullName,
      commercialName,
      sellerType,
      taxId,
      country,
      city,
      address,
      phone,
      email,
      preferredCurrency,
    });
    showToast('Dados da conta de vendedor salvos com sucesso!');
  };

  const countryConf = countriesConfig[country] || countriesConfig.GW;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Top Banner Status Card */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-blue-950 font-black text-2xl flex items-center justify-center border-2 border-white/20 shadow-md shrink-0">
            {fullName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black">{commercialName}</h1>
              <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" /> VERIFICADO
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-mono">
              Titular: {fullName} • {taxId}
            </p>
            <span className="text-[11px] text-yellow-300 font-bold block mt-1">
              {profile.kycLevel} (Aprovado em {profile.verificationDate})
            </span>
          </div>
        </div>

        <button
          onClick={() => onNavigateSection('kyc')}
          className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold px-4 py-2 rounded-xl text-xs transition backdrop-blur-xs flex items-center gap-2 shrink-0"
        >
          <ShieldCheck className="w-4 h-4 text-yellow-300" /> Ver Documentos KYC
        </button>
      </div>

      {/* Account Profile Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-6">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-700" /> Dados Cadastrais & Fiscais do Vendedor
          </h2>
          <span className="text-xs text-gray-400">Atualizado para operações transfronteiriças</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
          <div>
            <label className="block text-gray-700 font-bold mb-1">Nome Completo do Titular *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Nome Comercial / Razão Social *</label>
            <input
              type="text"
              value={commercialName}
              onChange={(e) => setCommercialName(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Tipo de Vendedor *</label>
            <select
              value={sellerType}
              onChange={(e) => setSellerType(e.target.value as any)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden bg-white"
            >
              <option value="pessoa_fisica">Pessoa Física / Autônomo</option>
              <option value="empresa_individual">Empresa Individual / MEI</option>
              <option value="sociedade">Sociedade Limitada / Lda</option>
              <option value="marca_oficial">Marca Oficial / Distribuidor</option>
              <option value="vendedor_internacional">Vendedor Internacional Exportador</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Documento Fiscal (NIF / CNPJ) *</label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">País Sede *</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryCode)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden bg-white"
            >
              {(Object.keys(countriesConfig) as CountryCode[]).map((c) => (
                <option key={c} value={c}>
                  {countriesConfig[c].flag} {countriesConfig[c].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Cidade *</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-700 font-bold mb-1">Endereço Fiscal / Sede Comercial *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Telefone / WhatsApp Comercial *</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">E-mail Comercial de Notificações *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Payout & Currency Preferences */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-700" /> Meios de Recebimento & Moeda Base
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Moeda Principal para Recebimentos</label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value as CurrencyCode)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden bg-white font-bold"
              >
                <option value="XOF">XOF - Franco CFA (África Ocidental)</option>
                <option value="EUR">EUR - Euro (Europa / Portugal)</option>
                <option value="BRL">BRL - Real (Brasil)</option>
                <option value="USD">USD - Dólar Norte-Americano</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onNavigateSection('payouts')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4 text-emerald-700" /> Gerenciar Contas de Saque (Orange / Bank)
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-xs flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar Alterações Cadastrais
          </button>
        </div>
      </form>
    </div>
  );
};
