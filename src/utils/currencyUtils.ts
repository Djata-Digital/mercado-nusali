import { CountryCode, CountryConfig, CurrencyCode } from '../types';

export const countriesConfig: Record<CountryCode, CountryConfig> = {
  GW: {
    code: 'GW',
    name: 'Guiné-Bissau',
    flag: '🇬🇼',
    currency: 'XOF',
    currencySymbol: 'CFA',
    exchangeRateToUSD: 605, // 1 USD = 605 CFA
    phonePrefix: '+245',
    paymentMethods: ['orange_money', 'mtn_money', 'nusali_wallet', 'credit_card'],
  },
  BR: {
    code: 'BR',
    name: 'Brasil',
    flag: '🇧🇷',
    currency: 'BRL',
    currencySymbol: 'R$',
    exchangeRateToUSD: 5.4, // 1 USD = 5.4 BRL
    phonePrefix: '+55',
    paymentMethods: ['pix', 'credit_card', 'boleto', 'nusali_wallet'],
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    currency: 'EUR',
    currencySymbol: '€',
    exchangeRateToUSD: 0.92, // 1 USD = 0.92 EUR
    phonePrefix: '+351',
    paymentMethods: ['credit_card', 'stripe_paypal', 'nusali_wallet'],
  },
  AO: {
    code: 'AO',
    name: 'Angola',
    flag: '🇦🇴',
    currency: 'AOA',
    currencySymbol: 'Kz',
    exchangeRateToUSD: 920, // 1 USD = 920 Kz
    phonePrefix: '+244',
    paymentMethods: ['credit_card', 'nusali_wallet'],
  },
  US: {
    code: 'US',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    currency: 'USD',
    currencySymbol: '$',
    exchangeRateToUSD: 1.0,
    phonePrefix: '+1',
    paymentMethods: ['credit_card', 'stripe_paypal', 'nusali_wallet'],
  },
};

export const formatCurrency = (
  amountInUSDOrLocal: number,
  currency: CurrencyCode = 'XOF',
  isBaseUSD: boolean = false
): string => {
  let finalAmount = amountInUSDOrLocal;

  if (isBaseUSD) {
    const config = Object.values(countriesConfig).find((c) => c.currency === currency);
    const rate = config ? config.exchangeRateToUSD : 1;
    finalAmount = amountInUSDOrLocal * rate;
  }

  const symbol =
    Object.values(countriesConfig).find((c) => c.currency === currency)?.currencySymbol || currency;

  if (currency === 'XOF') {
    return `${Math.round(finalAmount).toLocaleString('pt-GW')} ${symbol}`;
  }
  if (currency === 'BRL') {
    return `${symbol} ${finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'EUR') {
    return `${finalAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  }
  if (currency === 'AOA') {
    return `${Math.round(finalAmount).toLocaleString('pt-AO')} ${symbol}`;
  }
  return `${symbol} ${finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
