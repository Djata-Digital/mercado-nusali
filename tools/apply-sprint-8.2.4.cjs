const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
function write(rel, content) {
  const dst = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content, 'utf8');
  console.log('OK', rel);
}
function payload(rel) {
  return fs.readFileSync(path.join(__dirname, '..', 'payload', rel), 'utf8');
}
function replaceRequired(rel, before, after) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(after)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) throw new Error(`Trecho esperado não encontrado em ${rel}`);
  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.2.4 — Buyer Addresses + Shipping Rules reais ===');

write('src/api/clients/AddressesApi.ts', payload('src/api/clients/AddressesApi.ts'));
write('src/api/clients/ShippingQuotesApi.ts', payload('src/api/clients/ShippingQuotesApi.ts'));
write('src/components/AddressesView.tsx', payload('src/components/AddressesView.tsx'));
write('apps/api/src/modules/shipping-quotes/shipping-quotes.service.ts', payload('apps/api/src/modules/shipping-quotes/shipping-quotes.service.ts'));

const checkout = 'src/components/CheckoutView.tsx';

replaceRequired(
  checkout,
  "import React, { useState } from 'react';",
  "import React, { useEffect, useMemo, useState } from 'react';"
);

replaceRequired(
  checkout,
  "import { countriesConfig, formatCurrency } from '../utils/currencyUtils';",
  `import { countriesConfig, formatCurrency } from '../utils/currencyUtils';
import { useAuth } from '../context/AuthContext';
import { AddressesApi, RealAddress } from '../api/clients/AddressesApi';
import { ShippingQuoteOption, ShippingQuotesApi } from '../api/clients/ShippingQuotesApi';`
);

replaceRequired(
  checkout,
  `  const { selectedCountry, selectedCurrency } = usePreferences();

  const userLocation = { city: 'Bissau', state: 'Guiné-Bissau', zipCode: '1000', street: 'Avenida Amílcar Cabral', country: selectedCountry };

  const [country, setCountry] = useState<CountryCode>(userLocation.country || selectedCountry);

  // Address State
  const [address, setAddress] = useState<DeliveryAddress>({
    recipientName: 'Alex Silva',
    cpfOrTaxId: 'NIF 8941203',
    zipCode: userLocation.zipCode,
    street: userLocation.street,
    number: '12',
    complement: 'Apto 42',
    neighborhood: 'Praça dos Heróis',
    city: userLocation.city,
    state: userLocation.state,
    country: userLocation.country || selectedCountry,
    phone: '+245 955123456',
  });`,
  `  const { selectedCountry, selectedCurrency, showToast } = usePreferences();
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
    phone: \`\${real.phoneCode} \${real.phone}\`.trim(),
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
          throw new Error(\`A tarifa de frete está em \${data.currency}, mas o checkout está em \${selectedCurrency}.\`);
        }
        const selected = data.stores.map((store) => {
          const cheapest = [...store.options].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
          if (!cheapest) throw new Error(\`Nenhuma opção de entrega disponível para \${store.storeName}.\`);
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
  }, [cart.length, isAuthenticated, selectedAddressId, selectedCurrency]);`
);

replaceRequired(
  checkout,
  `  const [phoneNumber, setPhoneNumber] = useState('+245 955123456');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8892');
  const [cardHolder, setCardHolder] = useState('ALEX SILVA');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('321');`,
  `  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');`
);

replaceRequired(
  checkout,
  `  const isInternational = cart.some(
    (i) => i.product.shipping.isInternational || i.product.shipping.originCountry !== country
  );

  const customsDuty = isInternational ? cartTotal * 0.08 : 0;
  const shippingFee = cart.every((i) => i.product.shipping.freeShipping) ? 0 : 2500;
  const grandTotal = cartTotal + shippingFee + customsDuty;`,
  `  const isInternational = cart.some(
    (i) => i.product.shipping.isInternational || i.product.shipping.originCountry !== country
  );

  // Sprint 8.2.4: não inventar tributo aduaneiro nem frete.
  // Tributos serão consumidos do checkout session real na 8.2.5.
  const customsDuty = 0;
  const shippingFee = useMemo(
    () => shippingOptions.reduce((sum, entry) => sum + Number(entry.option.amount || 0), 0),
    [shippingOptions],
  );
  const grandTotal = cartTotal + shippingFee;`
);

replaceRequired(
  checkout,
  `  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);`,
  `  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddressId) {
      showToast('Selecione um endereço salvo antes de continuar.');
      return;
    }
    if (shippingError || shippingOptions.length === 0) {
      showToast(shippingError || 'Calcule uma opção de frete válida antes de continuar.');
      return;
    }
    setIsProcessing(true);`
);

// Never clear the cart when order creation fails.
replaceRequired(
  checkout,
  `    } catch (err) {
      console.error(err);
      clearCart();
      setIsProcessing(false);
      navigate('/orders/confirmation');
    }`,
  `    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      showToast(err?.response?.data?.message || err?.message || 'Não foi possível criar o pedido. Seu carrinho foi preservado.');
    }`
);

// Add selector above old editable address fields, preserving the approved layout.
replaceRequired(
  checkout,
  `            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">`,
  `            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">`
);

// Disable country selector: destination is derived from owned persisted address.
replaceRequired(
  checkout,
  `                <select
                  value={country}
                  onChange={(e) => {
                    const newCountry = e.target.value as CountryCode;
                    setCountry(newCountry);
                    setAddress({ ...address, country: newCountry });
                    const newPayMethods = countriesConfig[newCountry].paymentMethods;
                    if (!newPayMethods.includes(paymentMethod)) {
                      setPaymentMethod(newPayMethods[0] as PaymentMethodType);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold bg-gray-50"
                >`,
  `                <select
                  value={country}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-bold bg-gray-100 cursor-not-allowed"
                >`
);

// Replace misleading customs label with explicit server-calculated placeholder.
replaceRequired(
  checkout,
  `{isInternational && (
                <div className="flex justify-between text-amber-800 font-medium">
                  <span>Estimativa Tributo Aduaneiro:</span>
                  <span>{formatCurrency(customsDuty, countriesConfig[country].currency)}</span>
                </div>
              )}`,
  `{isInternational && (
                <div className="flex justify-between text-amber-800 font-medium">
                  <span>Tributos aduaneiros:</span>
                  <span>calculados no checkout real</span>
                </div>
              )}`
);

console.log('Sprint 8.2.4 aplicada. Execute o checker e a validação completa.');
