import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  User,
} from 'lucide-react';
import { SellerApi } from '../../api/clients/SellerApi';
import { useCountries } from '../../hooks/useCountries';

interface SellerOnboardingFormProps {
  onCreated: () => Promise<void> | void;
}

type SellerType =
  | 'INDIVIDUAL'
  | 'SOLE_PROPRIETOR'
  | 'COMPANY'
  | 'OFFICIAL_BRAND';

const sellerTypes: Array<{
  value: SellerType;
  label: string;
  description: string;
}> = [
  {
    value: 'INDIVIDUAL',
    label: 'Pessoa física',
    description: 'Venda em nome próprio.',
  },
  {
    value: 'SOLE_PROPRIETOR',
    label: 'Empresário individual',
    description: 'Negócio individual formalizado.',
  },
  {
    value: 'COMPANY',
    label: 'Empresa',
    description: 'Sociedade ou empresa constituída.',
  },
  {
    value: 'OFFICIAL_BRAND',
    label: 'Marca oficial',
    description: 'Empresa ou representante oficial de uma marca.',
  },
];

export const SellerOnboardingForm: React.FC<
  SellerOnboardingFormProps
> = ({ onCreated }) => {
  const countriesQuery = useCountries();

  const [sellerType, setSellerType] =
    useState<SellerType>('INDIVIDUAL');

  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [countryCode, setCountryCode] = useState('GW');
  const [taxId, setTaxId] = useState('');
  const [registrationNumber, setRegistrationNumber] =
    useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const countries = useMemo(() => {
    const data = countriesQuery.data;

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((country: any) => ({
        code:
          country.code ||
          country.countryCode ||
          country.iso2 ||
          '',
        name:
          country.name ||
          country.label ||
          country.namePt ||
          country.code ||
          '',
      }))
      .filter((country) => country.code);
  }, [countriesQuery.data]);

  const extractError = (error: any) =>
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Não foi possível criar o perfil de vendedor.';

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!legalName.trim()) {
      setErrorMessage('Informe o nome legal do vendedor.');
      return;
    }

    if (!countryCode.trim()) {
      setErrorMessage('Selecione o país.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await SellerApi.createOnboarding({
        sellerType,
        legalName: legalName.trim(),
        countryCode: countryCode.trim(),
        tradeName: tradeName.trim() || undefined,
        taxId: taxId.trim() || undefined,
        registrationNumber:
          registrationNumber.trim() || undefined,
        businessEmail:
          businessEmail.trim() || undefined,
        businessPhone:
          businessPhone.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Não foi possível criar o perfil.',
        );
      }

      setSuccessMessage(
        'Perfil de vendedor criado com sucesso.',
      );

      await onCreated();
    } catch (error: any) {
      setErrorMessage(extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="bg-slate-950 text-white p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-2xl font-black">
                Complete seu perfil de vendedor
              </h1>

              <p className="text-sm text-slate-300 mt-2 max-w-2xl">
                Antes de publicar produtos, precisamos identificar
                quem está vendendo no Mercado Nusali.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 space-y-8"
        >
          <section>
            <h2 className="font-black text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              Tipo de vendedor
            </h2>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {sellerTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setSellerType(type.value)
                  }
                  className={`text-left p-4 border-2 rounded-2xl transition ${
                    sellerType === type.value
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <div className="font-black text-sm text-gray-900">
                    {type.label}
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-black text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Dados comerciais
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nome legal *
                </label>

                <input
                  value={legalName}
                  onChange={(e) =>
                    setLegalName(e.target.value)
                  }
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                  placeholder="Nome completo ou razão social"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nome comercial
                </label>

                <input
                  value={tradeName}
                  onChange={(e) =>
                    setTradeName(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                  placeholder="Nome da loja ou negócio"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  País *
                </label>

                <select
                  value={countryCode}
                  onChange={(e) =>
                    setCountryCode(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm bg-white"
                >
                  {countries.length === 0 && (
                    <option value="GW">
                      Guiné-Bissau
                    </option>
                  )}

                  {countries.map((country) => (
                    <option
                      key={country.code}
                      value={country.code}
                    >
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Identificação fiscal / NIF
                </label>

                <input
                  value={taxId}
                  onChange={(e) =>
                    setTaxId(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Registro comercial
                </label>

                <input
                  value={registrationNumber}
                  onChange={(e) =>
                    setRegistrationNumber(
                      e.target.value,
                    )
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  E-mail comercial
                </label>

                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) =>
                    setBusinessEmail(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Telefone comercial
                </label>

                <input
                  value={businessPhone}
                  onChange={(e) =>
                    setBusinessPhone(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                  placeholder="+245..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Site
                </label>

                <input
                  value={website}
                  onChange={(e) =>
                    setWebsite(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Descrição do negócio
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm resize-none"
                placeholder="Descreva os produtos ou serviços que pretende vender."
              />
            </div>
          </section>

          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-800">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando perfil...
              </>
            ) : (
              'Continuar'
            )}
          </button>

          <p className="text-[11px] text-center text-gray-500">
            Depois desta etapa, você poderá enviar os documentos
            necessários para verificação KYC.
          </p>
        </form>
      </div>
    </div>
  );
};