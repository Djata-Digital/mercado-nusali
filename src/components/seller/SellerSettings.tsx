import React, { useState } from 'react';
import { Settings, Shield, Bell, Truck, FileText, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { SellerProfileData } from '../../data/mockSellerData';

interface SellerSettingsProps {
  showToast: (msg: string) => void;
  profile?: SellerProfileData;
  onUpdateProfile?: (profile: SellerProfileData) => void;
}

export const SellerSettings: React.FC<SellerSettingsProps> = ({ showToast, profile, onUpdateProfile }) => {
  const [vacationMode, setVacationMode] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [autoFreeShipping, setAutoFreeShipping] = useState(false);
  const [nifTaxId, setNifTaxId] = useState('NIF-982109482');

  const handleSaveSettings = () => {
    showToast('Configurações da loja e preferências atualizadas com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            Configurações Gerais da Loja
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Preferências de funcionamento, modo férias, regras de frete e configurações fiscais.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md"
        >
          <Save className="w-4 h-4" /> Salvar Alterações
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
        {/* Vacation Mode */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xs font-black text-gray-900 uppercase">Modo Férias / Pausa nas Vendas</h3>
            <p className="text-xs text-gray-500">Pausa temporariamente o recebimento de novos pedidos sem perder suas métricas de reputação.</p>
          </div>
          <button
            onClick={() => { setVacationMode(!vacationMode); showToast(vacationMode ? 'Modo férias desativado.' : 'Modo férias ativado!'); }}
            className="text-emerald-600"
          >
            {vacationMode ? <ToggleRight className="w-10 h-10 text-emerald-600" /> : <ToggleLeft className="w-10 h-10 text-gray-300" />}
          </button>
        </div>

        {/* Notifications */}
        <div className="space-y-3 border-b border-gray-100 pb-4">
          <h3 className="text-xs font-black text-gray-900 uppercase">Alertas & Notificações</h3>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700 font-bold">Alertas por E-mail em cada venda:</span>
            <input type="checkbox" checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} className="w-4 h-4 text-emerald-600 rounded" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700 font-bold">Alertas SMS / WhatsApp para perguntas de clientes:</span>
            <input type="checkbox" checked={smsAlerts} onChange={() => setSmsAlerts(!smsAlerts)} className="w-4 h-4 text-emerald-600 rounded" />
          </div>
        </div>

        {/* Fiscal NIF */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-gray-900 uppercase">Identificação Fiscal (NIF / CNPJ)</h3>
          <input
            type="text"
            value={nifTaxId}
            onChange={(e) => setNifTaxId(e.target.value)}
            className="w-full max-w-md p-2.5 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
};
