import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { CheckoutApi } from '../api/clients/CheckoutApi';
import { usePreferences } from '../context/PreferencesContext';
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  FileText,
  MapPin,
  CheckCircle,
  Truck,
  Copy,
  Lock,
  ArrowRight,
  Smartphone,
  Globe,
} from 'lucide-react';
import { DeliveryAddress, CountryCode } from '../types';
import { countriesConfig, formatCurrency } from '../utils/currencyUtils';
import { useAuth } from '../context/AuthContext';
import { AddressesApi, RealAddress } from '../api/clients/AddressesApi';
import { ShippingQuoteOption, ShippingQuotesApi } from '../api/clients/ShippingQuotesApi';

export const CheckoutView: React.FC = () => {
  const navigate = useNavigate();
  const { items: cart, total: cartTotal, refreshCart } = useCart();
  const { selectedCountry, selectedCurrency, showToast } = usePreferences();
  const { isAuthenticated } = useAuth();

  const [savedAddresses, setSavedAddresses] = useState<RealAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [shippingOptions, setShippingOptions] = useState<Array<{ storeId: string; storeName: string; option: ShippingQuoteOption }>>([]);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [isLoadingDelivery, setIsLoadingDelivery] = useState(false);
  const [country, setCountry] = useState<CountryCode>(selectedCountry);

  const [address, setAddress] = useState<DeliveryAddress>({
    recipientName: '',
    cpfOrTaxId: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: selectedCountry,
    phone: '',
  });

  const mapAddress = (real: RealAddress): DeliveryAddress => ({
    recipientName: real.recipientName,
    cpfOrTaxId: '',
    zipCode: real.postalCode || '',
    street: real.street,
    number: real.number,
    complement: real.complement || '',
    neighborhood: real.neighborhood || real.district || '',
    city: real.city,
    state: real.region,
    country: real.country.code as CountryCode,
    phone: `${real.phoneCode} ${real.phone}`.trim(),
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const loadDelivery = async () => {
      setIsLoadingDelivery(true);
      try {
        const res = await AddressesApi.list();
        const list = res.data || [];
        if (cancelled) return;
        setSavedAddresses(list);
        const preferred = list.find((entry) => entry.isDefault) || list[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          const mapped = mapAddress(preferred);
          setAddress(mapped);
          setCountry(mapped.country);
        }
      } catch (error: any) {
        if (!cancelled) setShippingError(error?.response?.data?.message || 'Não foi possível carregar os endereços.');
      } finally {
        if (!cancelled) setIsLoadingDelivery(false);
      }
    };
    void loadDelivery();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !selectedAddressId || cart.length === 0) {
      setShippingOptions([]);
      return;
    }
    let cancelled = false;
    const quote = async () => {
      setIsLoadingDelivery(true);
      setShippingError(null);
      try {
        const res = await ShippingQuotesApi.calculate(selectedAddressId);
        const data = res.data;
        if (!data) throw new Error('Resposta de cotação vazia.');
        if (data.currency !== selectedCurrency) {
          throw new Error(`A tarifa de frete está em ${data.currency}, mas o checkout está em ${selectedCurrency}.`);
        }
        const selected = data.stores.map((store) => {
          const cheapest = [...store.options].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
          if (!cheapest) throw new Error(`Nenhuma opção de entrega disponível para ${store.storeName}.`);
          return { storeId: store.storeId, storeName: store.storeName, option: cheapest };
        });
        if (!cancelled) setShippingOptions(selected);
      } catch (error: any) {
        if (!cancelled) {
          setShippingOptions([]);
          setShippingError(error?.response?.data?.message || error?.message || 'Não foi possível calcular o frete.');
        }
      } finally {
        if (!cancelled) setIsLoadingDelivery(false);
      }
    };
    void quote();
    return () => { cancelled = true; };
  }, [cart.length, isAuthenticated, selectedAddressId, selectedCurrency]);

  // Payment State

  const [isProcessing, setIsProcessing] = useState(false);

  const isInternational = cart.some(
    (i) => i.product.shipping.isInternational || i.product.shipping.originCountry !== country
  );

  // Sprint 8.2.4: não inventar tributo aduaneiro nem frete.
  // Tributos serão consumidos do checkout session real na 8.2.5.
  const customsDuty = 0;
  const shippingFee = useMemo(
    () => shippingOptions.reduce((sum, entry) => sum + Number(entry.option.amount || 0), 0),
    [shippingOptions],
  );
  const grandTotal = cartTotal + shippingFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddressId) {
      showToast('Selecione um endereço salvo antes de continuar.');
      return;
    }
    if (shippingError || shippingOptions.length === 0) {
      showToast(shippingError || 'Calcule uma opção de frete válida antes de continuar.');
      return;
    }
    setIsProcessing(true);

    try {
      // O frontend envia somente identidade do endereço e códigos de serviço.
      // Preço, desconto, frete, imposto, total, estoque e pedidos são resolvidos no servidor.
      const sessionResponse = await CheckoutApi.createSession(selectedAddressId);
      const sessionData = sessionResponse.data;
      if (!sessionData?.session?.id) {
        throw new Error('A API não retornou uma sessão de checkout válida.');
      }

      const canonicalSelections = shippingOptions.map((entry) => ({
        storeId: entry.storeId,
        serviceCode: entry.option.serviceCode,
      }));

      const confirmResponse = await CheckoutApi.confirm(
        sessionData.session.id,
        canonicalSelections,
      );
      const confirmed = confirmResponse.data;
      const firstOrder = confirmed?.orders?.[0];

      if (!confirmed?.orderGroup?.id || !firstOrder?.id) {
        throw new Error('Checkout confirmado sem pedido persistido.');
      }

      await refreshCart();
      setIsProcessing(false);
      navigate(`/orders/${firstOrder.id}/confirmation`);
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      showToast(err?.response?.data?.message || err?.message || 'Não foi possível criar o pedido. Seu carrinho foi preservado.');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600 font-medium">Não há itens no carrinho para finalizar a compra.</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition"
        >
          Voltar às Compras
        </button>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Lock className="w-6 h-6 text-emerald-600" /> Checkout Seguro Internacional - Proteção Escrow
        </h1>
        <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Encriptação SSL 256-bit
        </span>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Address Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
              <MapPin className="w-5 h-5 text-emerald-600" /> 1. Endereço de Destino e Destinatário
            </h2>

            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <label className="block font-bold text-emerald-900 mb-1">Endereço salvo</label>
              <select
                value={selectedAddressId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedAddressId(id);
                  const selected = savedAddresses.find((entry) => entry.id === id);
                  if (selected) {
                    const mapped = mapAddress(selected);
                    setAddress(mapped);
                    setCountry(mapped.country);
                  }
                }}
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-white font-semibold"
              >
                <option value="">Selecione um endereço cadastrado</option>
                {savedAddresses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.isDefault ? '★ ' : ''}{entry.label || entry.recipientName} — {entry.city}, {entry.country.name}
                  </option>
                ))}
              </select>
              {isLoadingDelivery && <p className="mt-2 text-emerald-700">Atualizando endereço e frete...</p>}
              {shippingError && <p className="mt-2 text-red-700 font-semibold">{shippingError}</p>}
              {!isLoadingDelivery && savedAddresses.length === 0 && (
                <button type="button" onClick={() => navigate('/addresses')} className="mt-2 text-emerald-800 underline font-bold">
                  Cadastrar endereço
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">País do Destinatário</label>
                <select
                  value={country}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-bold bg-gray-100 cursor-not-allowed"
                >
                  {(Object.keys(countriesConfig) as CountryCode[]).map((c) => (
                    <option key={c} value={c}>
                      {countriesConfig[c].flag} {countriesConfig[c].name} ({countriesConfig[c].currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={address.recipientName}
                  onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Documento de Identificação (NIF / BI / CPF)</label>
                <input
                  type="text"
                  value={address.cpfOrTaxId}
                  onChange={(e) => setAddress({ ...address, cpfOrTaxId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Telefone de Contacto (Com WhatsApp)</label>
                <input
                  type="text"
                  value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Rua / Avenida / Bairro</label>
                  <input
                    type="text"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Número / Lote</label>
                  <input
                    type="text"
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Payment Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
              <Lock className="w-5 h-5 text-emerald-600" /> 2. Pagamento
            </h2>
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 space-y-2">
              <p className="font-black">Pedido será criado como aguardando pagamento.</p>
              <p>
                Esta etapa não simula Orange Money, MTN Money, PIX ou cartão. A cobrança real será
                habilitada somente quando os provedores de pagamento forem integrados e homologados.
              </p>
              <p className="font-semibold">
                Nenhum PIN, cartão, CVV ou confirmação USSD é solicitado nesta versão.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-3">
              Resumo do Pedido ({cart.length} itens)
            </h2>

            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(cartTotal, countriesConfig[country].currency)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Logística Cross-Border:</span>
                <span className="font-bold text-emerald-700">
                  {shippingFee === 0 ? 'GRÁTIS' : formatCurrency(shippingFee, countriesConfig[country].currency)}
                </span>
              </div>

              {isInternational && (
                <div className="flex justify-between text-amber-800 font-medium">
                  <span>Tributos aduaneiros:</span>
                  <span>calculados no checkout real</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-gray-900">Total com Escrow:</span>
              <span className="text-2xl font-black text-emerald-800">
                {formatCurrency(grandTotal, countriesConfig[country].currency)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Processando Retenção Escrow...</span>
              ) : (
                <>
                  <span>CONFIRMAR PEDIDO E PAGAR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-[11px] text-gray-500 text-center space-y-1">
              <p className="flex items-center justify-center gap-1 font-semibold text-emerald-700">
                <Lock className="w-3.5 h-3.5" /> Dinheiro protegido até à confirmação de entrega
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
