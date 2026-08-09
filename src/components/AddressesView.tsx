import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { BuyerNavHeader } from './BuyerNavHeader';
import { CountriesApi } from '../api/clients/CountriesApi';
import {
  AddressesApi,
  CreateRealAddressInput,
  RealAddress,
  RealCountry,
} from '../api/clients/AddressesApi';

const normalizeCountries = (response: any): RealCountry[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export const AddressesView: React.FC = () => {
  const { showToast } = usePreferences();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [addresses, setAddresses] = useState<RealAddress[]>([]);
  const [countries, setCountries] = useState<RealCountry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formRecipient, setFormRecipient] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formComplement, setFormComplement] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formZip, setFormZip] = useState('');
  const [formCountryId, setFormCountryId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLabel, setFormLabel] = useState('');

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === formCountryId) || countries[0],
    [countries, formCountryId],
  );

  const load = async () => {
    if (!isAuthenticated) {
      setAddresses([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [addressResponse, countryResponse] = await Promise.all([
        AddressesApi.list(),
        CountriesApi.list(),
      ]);
      setAddresses(addressResponse.data || []);
      const loadedCountries = normalizeCountries(countryResponse);
      setCountries(loadedCountries);
      if (!formCountryId && loadedCountries[0]) setFormCountryId(loadedCountries[0].id);
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Não foi possível carregar seus endereços.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const resetForm = () => {
    setFormRecipient('');
    setFormStreet('');
    setFormNumber('');
    setFormComplement('');
    setFormNeighborhood('');
    setFormRegion('');
    setFormCity('');
    setFormZip('');
    setFormPhone('');
    setFormLabel('');
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCountry || !formRecipient || !formStreet || !formCity || !formRegion || !formPhone) {
      showToast('Preencha destinatário, país, região, cidade, rua e telefone.');
      return;
    }

    const payload: CreateRealAddressInput = {
      label: formLabel || undefined,
      recipientName: formRecipient.trim(),
      phone: formPhone.trim(),
      phoneCode: selectedCountry.phonePrefix,
      countryId: selectedCountry.id,
      region: formRegion.trim(),
      city: formCity.trim(),
      neighborhood: formNeighborhood.trim() || undefined,
      street: formStreet.trim(),
      number: formNumber.trim() || 'S/N',
      complement: formComplement.trim() || undefined,
      postalCode: formZip.trim() || undefined,
      type: 'RESIDENTIAL',
    };

    setIsSaving(true);
    try {
      await AddressesApi.create(payload);
      await load();
      resetForm();
      setIsModalOpen(false);
      showToast('Endereço cadastrado com sucesso.');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Não foi possível cadastrar o endereço.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await AddressesApi.setDefault(id);
      await load();
      showToast('Endereço principal atualizado.');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Não foi possível alterar o endereço principal.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await AddressesApi.delete(id);
      await load();
      showToast('Endereço removido.');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Não foi possível remover o endereço.');
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <BuyerNavHeader />
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-600">
          Faça login para cadastrar e utilizar endereços de entrega.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Meus Endereços</h1>
            <p className="text-xs text-gray-500">Endereços salvos na sua conta e usados pelo checkout real.</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Adicionar Novo Endereço
        </button>
      </div>

      {isLoading ? (
        <div className="py-14 flex justify-center text-emerald-700">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <MapPin className="w-8 h-8 mx-auto text-gray-400 mb-3" />
          <p className="font-bold text-gray-800">Nenhum endereço cadastrado.</p>
          <p className="text-xs text-gray-500 mt-1">Cadastre um endereço real antes de finalizar uma compra.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-white rounded-2xl border p-6 shadow-xs transition flex flex-col justify-between ${
                addr.isDefault ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <span className="font-extrabold text-sm text-gray-900">{addr.recipientName}</span>
                  {addr.isDefault ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" /> PRINCIPAL
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleSetDefault(addr.id)}
                      className="text-xs text-emerald-700 hover:underline font-bold"
                    >
                      Tornar Principal
                    </button>
                  )}
                </div>

                <div className="text-xs text-gray-600 space-y-1 leading-relaxed">
                  {addr.label && <p className="font-semibold text-gray-800">{addr.label}</p>}
                  <p>{addr.street}, {addr.number} {addr.complement || ''}</p>
                  <p>{addr.neighborhood ? `${addr.neighborhood} - ` : ''}{addr.city}, {addr.region}</p>
                  <p className="font-semibold text-gray-800 flex items-center gap-1 mt-1">
                    <span>{addr.country?.flag || '🌍'}</span> {addr.country?.name || addr.countryId}
                    {addr.postalCode ? ` • CP: ${addr.postalCode}` : ''}
                  </p>
                  <p className="text-gray-500 font-mono pt-1">
                    Telefone: {addr.phoneCode} {addr.phone}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 mt-4 flex items-center justify-between text-xs font-bold text-gray-500">
                <span className="flex items-center gap-1 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Endereço verificado por ownership da conta
                </span>
                <button
                  onClick={() => void handleDelete(addr.id)}
                  className="text-red-600 hover:text-red-800 p-1 rounded transition"
                  title="Excluir Endereço"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <form onSubmit={handleSaveAddress} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Cadastrar Endereço de Entrega</h2>
            <p className="text-xs text-gray-500 mb-6">Os dados serão persistidos na sua conta no backend.</p>

            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-gray-700 mb-1">Etiqueta</label>
                <input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="Casa, Trabalho..." className="w-full p-2.5 border border-gray-300 rounded-xl" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Nome Completo do Destinatário *</label>
                <input value={formRecipient} onChange={e => setFormRecipient(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">País *</label>
                  <select value={formCountryId} onChange={e => setFormCountryId(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-xl bg-white">
                    <option value="">Selecione</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.flag || '🌍'} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Telefone *</label>
                  <div className="flex">
                    <span className="px-2.5 py-2.5 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl">{selectedCountry?.phonePrefix || '+'}</span>
                    <input value={formPhone} onChange={e => setFormPhone(e.target.value)} required className="min-w-0 flex-1 p-2.5 border border-gray-300 rounded-r-xl" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">Região/Estado *</label>
                  <input value={formRegion} onChange={e => setFormRegion(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Cidade *</label>
                  <input value={formCity} onChange={e => setFormCity(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Bairro</label>
                <input value={formNeighborhood} onChange={e => setFormNeighborhood(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-xl" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Rua / Avenida *</label>
                <input value={formStreet} onChange={e => setFormStreet(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">Número</label>
                  <input value={formNumber} onChange={e => setFormNumber(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Código Postal / ZIP</label>
                  <input value={formZip} onChange={e => setFormZip(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Complemento</label>
                <input value={formComplement} onChange={e => setFormComplement(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-xl" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-xs font-bold text-gray-700">Cancelar</button>
              <button disabled={isSaving} type="submit" className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Endereço
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
