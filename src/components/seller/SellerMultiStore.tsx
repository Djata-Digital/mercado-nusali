import React, { useState } from 'react';
import {
  Store,
  PlusCircle,
  Edit2,
  ExternalLink,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Shield,
  X,
  Save,
  Upload,
  Loader2,
  Globe,
  Mail,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { SellerStoreData } from '../../data/mockSellerData';
import { CountryCode } from '../../types';
import { countriesConfig } from '../../utils/currencyUtils';
import { StoresApi } from '../../api/clients/StoresApi';

interface SellerMultiStoreProps {
  stores: SellerStoreData[];
  selectedStoreId: string;
  onSelectStore: (id: string) => void;

  // Mantidos temporariamente para compatibilidade com SellerHubView atual.
  onAddStore?: (store: SellerStoreData) => void;
  onUpdateStore?: (store: SellerStoreData) => void;

  showToast: (msg: string) => void;
  openPublicStoreView?: (slug: string) => void;
}

const timezoneByCountry: Partial<Record<CountryCode, string>> = {
  GW: 'Africa/Bissau',
  PT: 'Europe/Lisbon',
  BR: 'America/Sao_Paulo',
  AO: 'Africa/Luanda',
};

const buildSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const extractErrorMessage = (error: any): string =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

export const SellerMultiStore: React.FC<SellerMultiStoreProps> = ({
  stores,
  selectedStoreId,
  onSelectStore,
  showToast,
  openPublicStoreView,
}) => {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] =
    useState<SellerStoreData | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState<CountryCode>('GW');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  const resetFiles = () => {
    setLogoFile(null);
    setBannerFile(null);
  };

  const handleOpenCreateModal = () => {
    setEditingStore(null);

    setName('');
    setDescription('');
    setCountry('GW');
    setCity('');
    setRegion('');
    setAddress('');
    setPhone('');
    setEmail('');
    setWebsite('');

    resetFiles();

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (store: SellerStoreData) => {
    setEditingStore(store);

    setName(store.name || '');
    setDescription(store.description || '');
    setCountry(store.country || 'GW');
    setCity(store.city || '');
    setRegion((store as any).region || '');
    setAddress(store.address || '');
    setPhone(store.phone || '');
    setEmail(store.email || '');
    setWebsite((store as any).website || '');

    resetFiles();

    setIsModalOpen(true);
  };

  const refreshStores = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['seller-stores-real'],
    });
  };

  const validateImage = (file: File) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowed.includes(file.type)) {
      showToast(
        'Imagem inválida. Utilize JPEG, PNG ou WEBP.',
      );
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast(
        'A imagem deve ter no máximo 5 MB.',
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!name.trim()) {
      showToast('Informe o nome da loja.');
      return;
    }

    if (!city.trim()) {
      showToast('Informe a cidade da loja.');
      return;
    }

    try {
      setSaving(true);

      if (editingStore) {
        const response = await StoresApi.updateMine(
          editingStore.id,
          {
            name: name.trim(),
            description:
              description.trim() || undefined,
            businessEmail:
              email.trim() || undefined,
            businessPhone:
              phone.trim() || undefined,
            website:
              website.trim() || undefined,
            addressLine1:
              address.trim() || undefined,
            city: city.trim() || undefined,
            region:
              region.trim() || undefined,
            timezone:
              timezoneByCountry[country] ||
              'UTC',
          },
        );

        if (!response.success) {
          throw new Error(
            response.error?.message ||
              'Falha ao atualizar loja.',
          );
        }

        if (logoFile) {
          await StoresApi.uploadLogo(
            editingStore.id,
            logoFile,
          );
        }

        if (bannerFile) {
          await StoresApi.uploadBanner(
            editingStore.id,
            bannerFile,
          );
        }

        await refreshStores();

        showToast(
          `Loja "${name}" atualizada com sucesso.`,
        );
      } else {
        const baseSlug = buildSlug(name);

        if (!baseSlug) {
          showToast(
            'Não foi possível gerar um identificador para a loja.',
          );
          return;
        }

        const response = await StoresApi.create({
          name: name.trim(),
          slug: baseSlug,
          countryCode: country,
          description:
            description.trim() || undefined,
          businessEmail:
            email.trim() || undefined,
          businessPhone:
            phone.trim() || undefined,
          website:
            website.trim() || undefined,
          addressLine1:
            address.trim() || undefined,
          city: city.trim() || undefined,
          region:
            region.trim() || undefined,
          timezone:
            timezoneByCountry[country] ||
            'UTC',
        });

        if (!response.success || !response.data) {
          throw new Error(
            response.error?.message ||
              'Falha ao criar loja.',
          );
        }

        const createdStore = response.data;

        if (logoFile) {
          await StoresApi.uploadLogo(
            createdStore.id,
            logoFile,
          );
        }

        if (bannerFile) {
          await StoresApi.uploadBanner(
            createdStore.id,
            bannerFile,
          );
        }

        await refreshStores();

        onSelectStore(createdStore.id);

        showToast(
          `Loja "${createdStore.name}" criada com sucesso.`,
        );
      }

      setIsModalOpen(false);
      resetFiles();
    } catch (error: any) {
      showToast(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-700" />
            Gerenciamento de Lojas
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Crie e administre as lojas vinculadas ao
            seu perfil de vendedor.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          Cadastrar Nova Loja
        </button>
      </div>

      {!stores.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />

          <h2 className="text-sm font-black text-gray-900">
            Nenhuma loja cadastrada
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            Cadastre sua primeira loja para começar
            a publicar produtos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stores.map((store) => {
            const isSelected =
              store.id === selectedStoreId;

            const countryConf =
              countriesConfig[store.country] ||
              countriesConfig.GW;

            return (
              <div
                key={store.id}
                className={`bg-white rounded-2xl border overflow-hidden transition shadow-2xs ${
                  isSelected
                    ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="h-28 bg-linear-to-br from-slate-800 to-emerald-900 relative overflow-hidden">
                  {store.banner ? (
                    <img
                      src={store.banner}
                      alt={`Banner ${store.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50">
                      <Store className="w-10 h-10" />
                    </div>
                  )}

                  <div className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                    {countryConf.flag}{' '}
                    {countryConf.name}
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                      LOJA ATIVA NO PAINEL
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3 -mt-10">
                    <div className="w-16 h-16 rounded-2xl border-2 border-white shadow-md bg-white overflow-hidden flex items-center justify-center">
                      {store.logo ? (
                        <img
                          src={store.logo}
                          alt={store.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-7 h-7 text-emerald-700" />
                      )}
                    </div>

                    <div className="mt-8 min-w-0">
                      <h3 className="font-bold text-sm text-gray-900 truncate">
                        {store.name}
                      </h3>

                      <p className="text-[11px] text-gray-500">
                        /{store.slug}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 min-h-8">
                    {store.description ||
                      'Sem descrição comercial cadastrada.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {store.city || 'Cidade não informada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {store.phone || 'Não informado'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">
                        {store.email || 'Não informado'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold">
                        {store.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    {!isSelected ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStore(store.id);
                          showToast(
                            `Loja selecionada: ${store.name}`,
                          );
                        }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-2 rounded-xl text-xs"
                      >
                        Selecionar Loja
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Loja em Uso
                      </span>
                    )}

                    <div className="flex gap-2">
                      {openPublicStoreView && (
                        <button
                          type="button"
                          onClick={() =>
                            openPublicStoreView(store.slug)
                          }
                          className="p-2 bg-gray-100 rounded-xl"
                          title="Abrir loja pública"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleOpenEditModal(store)
                        }
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
                        title="Editar loja"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-700" />

                {editingStore
                  ? `Editar Loja: ${editingStore.name}`
                  : 'Cadastrar Nova Loja'}
              </h3>

              <button
                type="button"
                disabled={saving}
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">
                  Nome da Loja *
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">
                  País Sede *
                </label>

                <select
                  value={country}
                  disabled={Boolean(editingStore)}
                  onChange={(e) =>
                    setCountry(
                      e.target.value as CountryCode,
                    )
                  }
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white disabled:bg-gray-100"
                >
                  {(
                    Object.keys(
                      countriesConfig,
                    ) as CountryCode[]
                  ).map((code) => (
                    <option
                      key={code}
                      value={code}
                    >
                      {countriesConfig[code].flag}{' '}
                      {countriesConfig[code].name}
                    </option>
                  ))}
                </select>

                {editingStore && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    A alteração do país da loja não é
                    permitida por este endpoint.
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">
                    Cidade *
                  </label>

                  <input
                    value={city}
                    onChange={(e) =>
                      setCity(e.target.value)
                    }
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Região / Estado
                  </label>

                  <input
                    value={region}
                    onChange={(e) =>
                      setRegion(e.target.value)
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Endereço
                </label>

                <input
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">
                    Telefone
                  </label>

                  <input
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value)
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    E-mail Comercial
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Site
                </label>

                <input
                  type="url"
                  value={website}
                  onChange={(e) =>
                    setWebsite(e.target.value)
                  }
                  placeholder="https://..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Descrição Comercial
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="border border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-emerald-500">
                  <span className="flex items-center gap-2 font-bold">
                    <Upload className="w-4 h-4 text-emerald-700" />
                    Logo da Loja
                  </span>

                  <span className="block text-[10px] text-gray-400 mt-1">
                    JPEG, PNG ou WEBP • máximo 5 MB
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0];

                      if (
                        file &&
                        validateImage(file)
                      ) {
                        setLogoFile(file);
                      }
                    }}
                  />

                  {logoFile && (
                    <span className="block text-[10px] text-emerald-700 mt-2 font-bold">
                      {logoFile.name}
                    </span>
                  )}
                </label>

                <label className="border border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-emerald-500">
                  <span className="flex items-center gap-2 font-bold">
                    <Upload className="w-4 h-4 text-emerald-700" />
                    Banner da Loja
                  </span>

                  <span className="block text-[10px] text-gray-400 mt-1">
                    JPEG, PNG ou WEBP • máximo 5 MB
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0];

                      if (
                        file &&
                        validateImage(file)
                      ) {
                        setBannerFile(file);
                      }
                    }}
                  />

                  {bannerFile && (
                    <span className="block text-[10px] text-emerald-700 mt-2 font-bold">
                      {bannerFile.name}
                    </span>
                  )}
                </label>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setIsModalOpen(false)
                  }
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingStore
                        ? 'Salvar Alterações'
                        : 'Criar Loja'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};