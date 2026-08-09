import React, { useState } from 'react';
import { Users, Send, Target, AlertTriangle, CheckCircle, BarChart3, Plus, X, MapPin, Mail, Phone, MessageSquare } from 'lucide-react';
import { mockRegionsList } from '../../data/mockRegions';

interface SupervisorItem {
  id: string;
  supervisorName: string;
  supervisorEmail: string;
  phone: string;
  regionName: string;
  countryCode: string;
  activeSellers: number;
  activeStores: number;
  monthlyOrders: number;
  status: 'active' | 'transferring' | 'inactive';
}

interface AdminRegionalSupervisorsProps {
  showToast: (msg: string) => void;
}

export const AdminRegionalSupervisors: React.FC<AdminRegionalSupervisorsProps> = ({ showToast }) => {
  const [supervisors, setSupervisors] = useState<SupervisorItem[]>(() =>
    mockRegionsList.map((r, idx) => ({
      id: `SUP-${r.id}`,
      supervisorName: r.supervisorName,
      supervisorEmail: r.supervisorEmail,
      phone: `+245 955${100000 + idx * 11111}`,
      regionName: r.name,
      countryCode: r.countryCode,
      activeSellers: r.activeSellers,
      activeStores: r.activeStores,
      monthlyOrders: r.monthlyOrders,
      status: 'active'
    }))
  );

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTransferSupervisor, setSelectedTransferSupervisor] = useState<SupervisorItem | null>(null);
  const [selectedMsgSupervisor, setSelectedMsgSupervisor] = useState<SupervisorItem | null>(null);

  // Form states - Add Supervisor
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [countryInput, setCountryInput] = useState('GW');
  const [regionInput, setRegionInput] = useState('Região de Bissau');
  const [sellersInput, setSellersInput] = useState('15');
  const [storesInput, setStoresInput] = useState('8');

  // Form states - Transfer
  const [targetRegion, setTargetRegion] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Form states - Message
  const [msgSubject, setMsgSubject] = useState('Acompanhamento Semanal de Vendedores');
  const [msgBody, setMsgBody] = useState('');

  const handleAddSupervisor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      showToast('Por favor, informe o nome do supervisor.');
      return;
    }

    const newSup: SupervisorItem = {
      id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
      supervisorName: nameInput,
      supervisorEmail: emailInput || `${nameInput.toLowerCase().replace(/\s+/g, '.')}@nusali.com`,
      phone: phoneInput || '+245 955000000',
      regionName: regionInput,
      countryCode: countryInput,
      activeSellers: parseInt(sellersInput, 10) || 10,
      activeStores: parseInt(storesInput, 10) || 5,
      monthlyOrders: 0,
      status: 'active'
    };

    setSupervisors(prev => [newSup, ...prev]);
    showToast(`Supervisor "${nameInput}" atribuído com sucesso à região ${regionInput}!`);
    setIsAddModalOpen(false);

    // Reset fields
    setNameInput('');
    setEmailInput('');
    setPhoneInput('');
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferSupervisor || !targetRegion.trim()) return;

    setSupervisors(prev => prev.map(s => {
      if (s.id === selectedTransferSupervisor.id) {
        return {
          ...s,
          regionName: targetRegion
        };
      }
      return s;
    }));

    showToast(`Supervisor "${selectedTransferSupervisor.supervisorName}" transferido com sucesso para a região ${targetRegion}!`);
    setSelectedTransferSupervisor(null);
    setTargetRegion('');
    setTransferNote('');
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMsgSupervisor) return;

    showToast(`Mensagem enviada com sucesso para o supervisor ${selectedMsgSupervisor.supervisorName}!`);
    setSelectedMsgSupervisor(null);
    setMsgBody('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Gestão de Supervisores Regionais
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Supervisores locais responsáveis pelo acompanhamento direto dos vendedores nas regiões da Guiné-Bissau e países CPLP.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Atribuir Novo Supervisor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {supervisors.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4 hover:border-emerald-300 transition">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block">
                  {s.countryCode === 'GW' ? '🇬🇼 Guiné-Bissau' : s.countryCode}
                </span>
                <h3 className="font-extrabold text-sm text-gray-900">{s.supervisorName}</h3>
                <p className="text-[11px] text-emerald-700 font-bold">{s.regionName}</p>
                <p className="text-[10px] text-gray-400">{s.supervisorEmail}</p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                ATIVO
              </span>
            </div>

            <div className="space-y-1.5 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex justify-between text-gray-600">
                <span>Vendedores Acompanhados:</span>
                <strong className="text-gray-900">{s.activeSellers} vendedores</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Lojas sob Gestão:</span>
                <strong className="text-gray-900">{s.activeStores} lojas</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Volume de Pedidos:</span>
                <strong className="text-emerald-700">{s.monthlyOrders} / mês</strong>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs border-t border-gray-100">
              <button
                onClick={() => {
                  setSelectedTransferSupervisor(s);
                  setTargetRegion(s.regionName);
                }}
                className="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer"
              >
                Transferir Região
              </button>
              <button
                onClick={() => setSelectedMsgSupervisor(s)}
                className="text-gray-600 hover:text-gray-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Enviar Mensagem
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL 1: Atribuir Novo Supervisor */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-gray-900">Atribuir Novo Supervisor Regional</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupervisor} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nome Completo do Supervisor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Amadu Bá"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    placeholder="amadu.ba@nusali.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+245 955..."
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">País</label>
                  <select
                    value={countryInput}
                    onChange={(e) => setCountryInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold bg-white"
                  >
                    <option value="GW">🇬🇼 Guiné-Bissau</option>
                    <option value="BR">🇧🇷 Brasil</option>
                    <option value="PT">🇵🇹 Portugal</option>
                    <option value="AO">🇦🇴 Angola</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Região Deslocada</label>
                  <input
                    type="text"
                    placeholder="Ex: Região de Cacheu"
                    value={regionInput}
                    onChange={(e) => setRegionInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Meta Vendedores Acompanhados</label>
                  <input
                    type="number"
                    value={sellersInput}
                    onChange={(e) => setSellersInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Meta Lojas sob Gestão</label>
                  <input
                    type="number"
                    value={storesInput}
                    onChange={(e) => setStoresInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Atribuir Supervisor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Transferir Região */}
      {selectedTransferSupervisor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-gray-900">Transferir Supervisor de Região</h3>
              </div>
              <button onClick={() => setSelectedTransferSupervisor(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
              <span className="text-gray-500 block">Supervisor:</span>
              <strong className="text-gray-900 font-extrabold">{selectedTransferSupervisor.supervisorName}</strong>
              <span className="text-gray-500 block mt-1">Região Atual: {selectedTransferSupervisor.regionName}</span>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nova Região de Destino *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Região de Tombali"
                  value={targetRegion}
                  onChange={(e) => setTargetRegion(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Motivo / Observações de Transferência</label>
                <textarea
                  rows={2}
                  placeholder="Reforço operacional para expansão de vendedores locais..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedTransferSupervisor(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer"
                >
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Enviar Mensagem ao Supervisor */}
      {selectedMsgSupervisor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-gray-900">Enviar Comunicação Direta</h3>
              </div>
              <button onClick={() => setSelectedMsgSupervisor(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs">
              <span className="text-emerald-800 block font-bold">Destinatário:</span>
              <strong className="text-emerald-950 font-extrabold">{selectedMsgSupervisor.supervisorName} ({selectedMsgSupervisor.supervisorEmail})</strong>
              <span className="text-emerald-700 block text-[10px]">Supervisor Regional - {selectedMsgSupervisor.regionName}</span>
            </div>

            <form onSubmit={handleSendMessageSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Assunto</label>
                <input
                  type="text"
                  required
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Mensagem / Diretriz Operacional</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Escreva a mensagem direcionada ao supervisor..."
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedMsgSupervisor(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar Mensagem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
