import React, { useState } from 'react';
import { Settings, Save, ToggleRight, ToggleLeft, Check } from 'lucide-react';

interface AdminPlatformSettingsProps {
  showToast: (msg: string) => void;
}

export const AdminPlatformSettings: React.FC<AdminPlatformSettingsProps> = ({ showToast }) => {
  const [platformName, setPlatformName] = useState('Mercado Nusali');
  const [escrowHours, setEscrowHours] = useState(48);
  const [commissionRate, setCommissionRate] = useState('4.5%');
  const [supportEmail, setSupportEmail] = useState('suporte@nusali.com');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Configurações globais atualizadas com sucesso no sistema!');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            Configurações Globais da Plataforma Mercado Nusali
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Definição de parâmetros globais da marca, prazos padrão de Escrow e taxas universais.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4 max-w-2xl">
        <h3 className="font-extrabold text-sm text-gray-900">Parâmetros Globais de Operação</h3>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Nome Oficial da Plataforma:</label>
            <input
              type="text"
              value={platformName}
              onChange={e => setPlatformName(e.target.value)}
              className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Prazo Padrão de Autoliberação Escrow (Horas sem Reclamação):</label>
            <input
              type="number"
              value={escrowHours}
              onChange={e => setEscrowHours(parseInt(e.target.value) || 24)}
              className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Taxa Base Universal de Comissão (%):</label>
            <input
              type="text"
              value={commissionRate}
              onChange={e => setCommissionRate(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">E-mail de Suporte Global:</label>
            <input
              type="email"
              value={supportEmail}
              onChange={e => setSupportEmail(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-gray-100">
            <div>
              <span className="font-bold text-gray-900 block">Modo de Manutenção Geral</span>
              <span className="text-[10px] text-gray-500">Bloqueia novos pedidos temporariamente para atualizações.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !maintenanceMode;
                setMaintenanceMode(next);
                showToast(next ? 'Modo de manutenção ATIVADO!' : 'Modo de manutenção DESATIVADO!');
              }}
              className="cursor-pointer"
            >
              {maintenanceMode ? (
                <ToggleRight className="w-8 h-8 text-amber-600" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-300" />
              )}
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-purple-600 text-white font-extrabold rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2 shadow-md cursor-pointer mt-4"
          >
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </form>
      </div>
    </div>
  );
};
