import React, { useState } from 'react';
import { UserCheck, Mail, Phone, Award, TrendingUp, UserX, Shield, Edit, Plus, X, Check } from 'lucide-react';
import { mockRepresentativesList, CountryRepresentative } from '../../data/mockRepresentatives';

interface AdminCountryRepresentativesProps {
  showToast: (msg: string) => void;
}

export const AdminCountryRepresentatives: React.FC<AdminCountryRepresentativesProps> = ({ showToast }) => {
  const [representatives, setRepresentatives] = useState<CountryRepresentative[]>(mockRepresentativesList);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editTargetRep, setEditTargetRep] = useState<CountryRepresentative | null>(null);

  // Invite Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryName, setCountryName] = useState('Guiné-Bissau (GW)');
  const [targetGMV, setTargetGMV] = useState('50.000.000 XOF');
  const [commissionRate, setCommissionRate] = useState('1.5%');

  // Goals Form
  const [newTargetGMV, setNewTargetGMV] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState('');

  const handleInviteRep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Por favor, informe o nome e o email do representante.');
      return;
    }

    const newRep: CountryRepresentative = {
      id: `REP-${Date.now().toString().slice(-4)}`,
      name,
      email,
      phone: phone || '+245 950000000',
      countryCode: 'GW',
      countryName,
      status: 'active',
      assignedSellersCount: 0,
      assignedStoresCount: 0,
      supervisorsCount: 1,
      monthlyRevenueFormatted: '0 XOF',
      monthlyOrders: 0,
      performanceScore: 100,
      targetGMVFormatted: targetGMV || '50.000.000 XOF',
      commissionRate: commissionRate || '1.5%',
      lastLogin: 'Agora mesmo',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
    };

    setRepresentatives(prev => [newRep, ...prev]);
    showToast(`Convite oficial enviado para ${name} (${email})!`);
    setIsInviteModalOpen(false);

    // Reset
    setName('');
    setEmail('');
    setPhone('');
    setCountryName('Guiné-Bissau (GW)');
    setTargetGMV('50.000.000 XOF');
    setCommissionRate('1.5%');
  };

  const handleOpenEditGoals = (rep: CountryRepresentative) => {
    setEditTargetRep(rep);
    setNewTargetGMV(rep.targetGMVFormatted);
    setNewCommissionRate(rep.commissionRate);
  };

  const handleSaveGoals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetRep) return;

    setRepresentatives(prev =>
      prev.map(r =>
        r.id === editTargetRep.id
          ? { ...r, targetGMVFormatted: newTargetGMV, commissionRate: newCommissionRate }
          : r
      )
    );
    showToast(`Metas de ${editTargetRep.name} atualizadas para ${newTargetGMV}!`);
    setEditTargetRep(null);
  };

  const toggleRepStatus = (rep: CountryRepresentative) => {
    const nextStatus = rep.status === 'active' ? 'suspended' : 'active';
    setRepresentatives(prev =>
      prev.map(r => r.id === rep.id ? { ...r, status: nextStatus } : r)
    );
    showToast(`Status do representante ${rep.name} alterado para ${nextStatus.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-purple-600" />
            Gestão de Representantes Nacionais (Country Managers)
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Supervisão geral das lideranças nacionais da plataforma em Guiné-Bissau, Brasil, Portugal e Angola.
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Convidar Representante Nacional
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {representatives.map(rep => (
          <div key={rep.id} className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4 hover:border-purple-300 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img src={rep.avatar} alt={rep.name} className="w-14 h-14 rounded-full object-cover border-2 border-purple-500" />
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">{rep.name}</h3>
                  <span className="text-xs font-bold text-purple-700 block">{rep.countryName} • {rep.phone}</span>
                  <p className="text-[10px] text-gray-400">{rep.email}</p>
                </div>
              </div>

              <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full ${
                rep.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {rep.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-gray-400 text-[10px] block font-bold">Vendedores</span>
                <span className="font-extrabold text-gray-900">{rep.assignedSellersCount}</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block font-bold">Supervisores</span>
                <span className="font-extrabold text-gray-900">{rep.supervisorsCount} equipe</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block font-bold">Receita Mensal</span>
                <span className="font-extrabold text-emerald-700">{rep.monthlyRevenueFormatted}</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block font-bold">Desempenho</span>
                <span className="font-extrabold text-purple-700 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" /> {rep.performanceScore}%
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Meta GMV Mensal: <strong>{rep.targetGMVFormatted}</strong></span>
                <span>Comissão: <strong>{rep.commissionRate}</strong></span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${rep.performanceScore}%` }} />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between text-xs border-t border-gray-100 gap-2">
              <span className="text-[10px] text-gray-400">Último Acesso: {rep.lastLogin}</span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditGoals(rep)}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 font-bold rounded-lg hover:bg-purple-100 transition cursor-pointer"
                >
                  Definir Metas
                </button>
                <button
                  onClick={() => toggleRepStatus(rep)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition cursor-pointer"
                >
                  {rep.status === 'active' ? 'Suspender' : 'Reativar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Convidar Representante */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600" /> Convidar Country Manager
              </h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteRep} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nome Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Fatu N'Djai"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">E-mail Comercial:</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: fatu@nusali.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Telefone / WhatsApp:</label>
                  <input
                    type="text"
                    placeholder="+245 95555555"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">País de Atuação:</label>
                  <select
                    value={countryName}
                    onChange={e => setCountryName(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                  >
                    <option value="Guiné-Bissau (GW)">🇬🇼 Guiné-Bissau</option>
                    <option value="Brasil (BR)">🇧🇷 Brasil</option>
                    <option value="Portugal (PT)">🇵🇹 Portugal</option>
                    <option value="Angola (AO)">🇦🇴 Angola</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Meta GMV Inicial:</label>
                  <input
                    type="text"
                    placeholder="50.000.000 XOF"
                    value={targetGMV}
                    onChange={e => setTargetGMV(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Comissão sobre Vendas:</label>
                  <input
                    type="text"
                    placeholder="1.5%"
                    value={commissionRate}
                    onChange={e => setCommissionRate(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 font-bold text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Enviar Convite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Definir Metas */}
      {editTargetRep && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" /> Metas de {editTargetRep.name}
              </h3>
              <button onClick={() => setEditTargetRep(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoals} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Meta Mensal GMV:</label>
                <input
                  type="text"
                  required
                  value={newTargetGMV}
                  onChange={e => setNewTargetGMV(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Taxa de Comissão (%):</label>
                <input
                  type="text"
                  required
                  value={newCommissionRate}
                  onChange={e => setNewCommissionRate(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTargetRep(null)}
                  className="px-4 py-2 border border-gray-300 font-bold text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-md"
                >
                  Salvar Novas Metas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
