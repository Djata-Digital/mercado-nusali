import React, {
  useEffect,
  useState,
} from 'react';

import {
  UserCheck,
  CreditCard,
  BadgeCheck,
  ShieldCheck,
  Save,
} from 'lucide-react';

import {
  SellerProfileData,
} from '../../data/mockSellerData';

import {
  CountryCode,
  CurrencyCode,
} from '../../types';

import {
  countriesConfig,
} from '../../utils/currencyUtils';

interface SellerAccountProps {
  profile: SellerProfileData;

  onUpdateProfile: (
    profile: SellerProfileData,
  ) => void | Promise<void>;

  showToast: (
    message: string,
  ) => void;

  onNavigateSection: (
    section: any,
  ) => void;
}

export const SellerAccount: React.FC<
  SellerAccountProps
> = ({
  profile,
  onUpdateProfile,
  showToast,
  onNavigateSection,
}) => {
  const [
    fullName,
    setFullName,
  ] = useState(
    profile.fullName,
  );

  const [
    commercialName,
    setCommercialName,
  ] = useState(
    profile.commercialName,
  );

  const [
    sellerType,
    setSellerType,
  ] = useState(
    profile.sellerType,
  );

  const [
    taxId,
    setTaxId,
  ] = useState(
    profile.taxId,
  );

  const [
    country,
    setCountry,
  ] = useState<CountryCode>(
    profile.country,
  );

  const [
    city,
    setCity,
  ] = useState(
    profile.city,
  );

  const [
    address,
    setAddress,
  ] = useState(
    profile.address,
  );

  const [
    phone,
    setPhone,
  ] = useState(
    profile.phone,
  );

  const [
    email,
    setEmail,
  ] = useState(
    profile.email,
  );

  const [
    preferredCurrency,
    setPreferredCurrency,
  ] = useState<CurrencyCode>(
    profile.preferredCurrency,
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  /*
   * Quando o React Query recarregar
   * o perfil real após o salvamento,
   * sincronizamos os campos locais.
   */
  useEffect(() => {
    setFullName(
      profile.fullName,
    );

    setCommercialName(
      profile.commercialName,
    );

    setSellerType(
      profile.sellerType,
    );

    setTaxId(
      profile.taxId,
    );

    setCountry(
      profile.country,
    );

    setCity(
      profile.city,
    );

    setAddress(
      profile.address,
    );

    setPhone(
      profile.phone,
    );

    setEmail(
      profile.email,
    );

    setPreferredCurrency(
      profile.preferredCurrency,
    );
  }, [profile]);

  const handleSave = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!fullName.trim()) {
      showToast(
        'Informe o nome completo do titular.',
      );

      return;
    }

    if (!commercialName.trim()) {
      showToast(
        'Informe o nome comercial ou razão social.',
      );

      return;
    }

    if (!taxId.trim()) {
      showToast(
        'Informe o documento fiscal.',
      );

      return;
    }

    if (!city.trim()) {
      showToast(
        'Informe a cidade.',
      );

      return;
    }

    if (!address.trim()) {
      showToast(
        'Informe o endereço fiscal ou sede comercial.',
      );

      return;
    }

    if (!phone.trim()) {
      showToast(
        'Informe o telefone comercial.',
      );

      return;
    }

    if (!email.trim()) {
      showToast(
        'Informe o e-mail comercial.',
      );

      return;
    }

    try {
      setSaving(true);

      await onUpdateProfile({
        ...profile,

        fullName:
          fullName.trim(),

        commercialName:
          commercialName.trim(),

        sellerType,

        taxId:
          taxId.trim(),

        country,

        city:
          city.trim(),

        address:
          address.trim(),

        phone:
          phone.trim(),

        email:
          email.trim(),

        preferredCurrency,
      });
    } finally {
      setSaving(false);
    }
  };

  const countryConf =
    countriesConfig[country] ||
    countriesConfig.GW;

  const statusConfig =
    profile.kycStatus ===
    'verified'
      ? {
          label:
            'VERIFICADO',
          className:
            'bg-emerald-500',
        }
      : profile.kycStatus ===
          'under_review'
        ? {
            label:
              'EM ANÁLISE',
            className:
              'bg-blue-500',
          }
        : profile.kycStatus ===
            'rejected'
          ? {
              label:
                'REJEITADO',
              className:
                'bg-red-500',
            }
          : {
              label:
                'PENDENTE',
              className:
                'bg-amber-500',
            };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Status do vendedor */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-blue-950 font-black text-2xl flex items-center justify-center border-2 border-white/20 shadow-md shrink-0">
            {fullName
              .substring(0, 2)
              .toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black">
                {commercialName ||
                  fullName}
              </h1>

              <span
                className={`${statusConfig.className} text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1`}
              >
                <BadgeCheck className="w-3.5 h-3.5" />

                {
                  statusConfig.label
                }
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1 font-mono">
              Titular:{' '}
              {fullName}
              {taxId
                ? ` • ${taxId}`
                : ''}
            </p>

            <span className="text-[11px] text-yellow-300 font-bold block mt-1">
              {profile.kycLevel}

              {profile.kycStatus ===
                'verified' &&
              profile.verificationDate
                ? ` • Aprovado em ${profile.verificationDate}`
                : ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onNavigateSection(
              'kyc',
            )
          }
          className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold px-4 py-2 rounded-xl text-xs transition backdrop-blur-xs flex items-center gap-2 shrink-0"
        >
          <ShieldCheck className="w-4 h-4 text-yellow-300" />

          Ver Documentos KYC
        </button>
      </div>

      {/* Formulário */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-6"
      >
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-700" />

            Dados Cadastrais &
            Fiscais do Vendedor
          </h2>

          <span className="text-xs text-gray-400 hidden sm:block">
            Dados integrados ao
            perfil real do Mercado
            Nusali
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Nome Completo do
              Titular *
            </label>

            <input
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Nome Comercial /
              Razão Social *
            </label>

            <input
              type="text"
              value={
                commercialName
              }
              onChange={(event) =>
                setCommercialName(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Tipo de Vendedor *
            </label>

            <select
              value={
                sellerType
              }
              onChange={(event) =>
                setSellerType(
                  event.target
                    .value as SellerProfileData['sellerType'],
                )
              }
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden bg-white"
            >
              <option value="pessoa_fisica">
                Pessoa Física /
                Autônomo
              </option>

              <option value="empresa_individual">
                Empresa Individual
                / MEI
              </option>

              <option value="sociedade">
                Sociedade Limitada
                / Lda
              </option>

              <option value="marca_oficial">
                Marca Oficial /
                Distribuidor
              </option>

              <option value="vendedor_internacional">
                Vendedor
                Internacional
                Exportador
              </option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Documento Fiscal
              (NIF / CNPJ) *
            </label>

            <input
              type="text"
              value={taxId}
              onChange={(event) =>
                setTaxId(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              País Sede *
            </label>

            <select
              value={country}
              onChange={(event) =>
                setCountry(
                  event.target
                    .value as CountryCode,
                )
              }
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden bg-white"
            >
              {(
                Object.keys(
                  countriesConfig,
                ) as CountryCode[]
              ).map(
                (
                  countryCode,
                ) => (
                  <option
                    key={
                      countryCode
                    }
                    value={
                      countryCode
                    }
                  >
                    {
                      countriesConfig[
                        countryCode
                      ].flag
                    }{' '}
                    {
                      countriesConfig[
                        countryCode
                      ].name
                    }
                  </option>
                ),
              )}
            </select>

            <div className="mt-1 text-[10px] text-gray-400">
              País atual:{' '}
              {countryConf.flag}{' '}
              {countryConf.name}
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Cidade *
            </label>

            <input
              type="text"
              value={city}
              onChange={(event) =>
                setCity(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
              placeholder="Ex.: Bissau"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-700 font-bold mb-1">
              Endereço Fiscal /
              Sede Comercial *
            </label>

            <input
              type="text"
              value={address}
              onChange={(event) =>
                setAddress(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
              placeholder="Ex.: Avenida Amílcar Cabral, 140"
            />

            <p className="text-[10px] text-gray-400 mt-1">
              Este endereço será
              registrado como endereço
              comercial da conta do
              vendedor.
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Telefone / WhatsApp
              Comercial *
            </label>

            <input
              type="text"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
              placeholder="+245 955123456"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              E-mail Comercial de
              Notificações *
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target
                    .value,
                )
              }
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Recebimentos */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-700" />

            Meios de Recebimento &
            Moeda Base
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Moeda Principal para
                Recebimentos
              </label>

              <select
                value={
                  preferredCurrency
                }
                onChange={(event) =>
                  setPreferredCurrency(
                    event.target
                      .value as CurrencyCode,
                  )
                }
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-emerald-600 focus:outline-hidden bg-white font-bold"
              >
                <option value="XOF">
                  XOF - Franco CFA
                  (África Ocidental)
                </option>

                <option value="EUR">
                  EUR - Euro (Europa /
                  Portugal)
                </option>

                <option value="BRL">
                  BRL - Real (Brasil)
                </option>

                <option value="USD">
                  USD - Dólar
                  Norte-Americano
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  onNavigateSection(
                    'payouts',
                  )
                }
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4 text-emerald-700" />

                Gerenciar Contas de
                Saque (Orange / Bank)
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />

                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />

                Salvar Alterações
                Cadastrais
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};