const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function write(rel, content) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log('OK', rel);
}

function replaceRequired(rel, before, after) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes(after)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) {
    throw new Error(`Trecho esperado não encontrado em ${rel}`);
  }
  s = s.replace(before, after);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK', rel);
}

function replaceRegexRequired(rel, regex, after, alreadyMarker) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  if (alreadyMarker && s.includes(alreadyMarker)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!regex.test(s)) {
    throw new Error(`Bloco esperado não encontrado em ${rel}`);
  }
  s = s.replace(regex, after);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.2.5 — Checkout real + OrderGroup real ===');

write('src/api/clients/CheckoutApi.ts', `import { apiClient, ApiResponse } from '../apiClient';

export interface CheckoutSessionShippingOption {
  providerCode: string;
  serviceCode: string;
  serviceName: string;
  cost: string | number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  status: string;
}

export interface CheckoutSessionResult {
  session: {
    id: string;
    status: string;
    expiresAt: string;
    addressId: string;
    currency?: { code?: string };
  };
  cartSummary: any;
  stores: any[];
  shippingQuotes: Record<string, CheckoutSessionShippingOption[]>;
}

export interface CheckoutConfirmResult {
  orderGroup: {
    id: string;
    status: string;
    total: string | number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string | number;
  }>;
  stockReservation?: {
    id: string;
    status: string;
    expiresAt: string;
  } | null;
}

export class CheckoutApi {
  static createSession(addressId: string, couponCode?: string): Promise<ApiResponse<CheckoutSessionResult>> {
    return apiClient.post('/checkout/session', {
      addressId,
      ...(couponCode ? { couponCode } : {}),
    });
  }

  static confirm(
    checkoutSessionId: string,
    shippingSelections: Array<{ storeId: string; serviceCode: string }>,
  ): Promise<ApiResponse<CheckoutConfirmResult>> {
    return apiClient.post('/checkout/confirm', {
      checkoutSessionId,
      shippingSelections,
    });
  }
}
`);
write('apps/api/src/modules/checkout/shipping/shipping-calculation.service.ts', `import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ShippingCalculationRequest {
  originCountryId: string;
  destinationCountryId: string;
  postalCode?: string;
  storeId: string;
  warehouseId?: string;
  totalWeightKg: number;
  totalVolumeM3: number;
  subtotal: number;
  currencyId: string;
}

export interface ShippingOption {
  providerCode: string;
  serviceCode: string;
  serviceName: string;
  carrierId?: string;
  cost: string | number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  status: 'CALCULATED' | 'ESTIMATED' | 'FALLBACK';
}

export interface IShippingCalculationProvider {
  providerCode: string;
  calculateShipping(request: ShippingCalculationRequest): Promise<ShippingOption[]>;
}

/**
 * Mantidos apenas por compatibilidade de DI com CheckoutModule.
 * Não geram tarifas comerciais.
 */
@Injectable()
export class InternalShippingProvider implements IShippingCalculationProvider {
  readonly providerCode = 'INTERNAL_SHIPPING_DISABLED';
  async calculateShipping(): Promise<ShippingOption[]> {
    return [];
  }
}

@Injectable()
export class GenericLocalShippingProvider implements IShippingCalculationProvider {
  readonly providerCode = 'GENERIC_LOCAL_SHIPPING_DISABLED';
  async calculateShipping(): Promise<ShippingOption[]> {
    return [];
  }
}

/**
 * Fonte comercial canônica do checkout.
 *
 * Regras:
 * - somente ShippingRateRule ativa no PostgreSQL;
 * - moeda obrigatoriamente igual à moeda do carrinho;
 * - regra específica da loja prevalece sobre regra global;
 * - cálculo monetário com Prisma.Decimal;
 * - sem provider simulado;
 * - sem frete fixo/fallback silencioso.
 */
@Injectable()
export class ShippingCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    _internalProvider: InternalShippingProvider,
    _genericProvider: GenericLocalShippingProvider,
  ) {}

  async calculateShippingOptions(request: ShippingCalculationRequest): Promise<ShippingOption[]> {
    const rules = await this.prisma.shippingRateRule.findMany({
      where: {
        originCountryId: request.originCountryId,
        destinationCountryId: request.destinationCountryId,
        currencyId: request.currencyId,
        isActive: true,
        OR: [{ storeId: request.storeId }, { storeId: null }],
      },
      orderBy: [{ storeId: 'desc' }, { serviceCode: 'asc' }],
    });

    const storeSpecific = rules.filter((rule) => rule.storeId === request.storeId);
    const applicable = storeSpecific.length
      ? storeSpecific
      : rules.filter((rule) => rule.storeId === null);

    if (!applicable.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Nenhuma tarifa de frete real está configurada para esta rota, loja e moeda.',
        errorCode: 'CHECKOUT_SHIPPING_RATE_NOT_CONFIGURED',
      });
    }

    const weight = new Prisma.Decimal(String(request.totalWeightKg || 0));

    return applicable.map((rule) => {
      const cost = new Prisma.Decimal(rule.baseAmount).plus(
        new Prisma.Decimal(rule.amountPerKg).mul(weight),
      );

      return {
        providerCode: 'DB_RULE',
        serviceCode: rule.serviceCode,
        serviceName: rule.name,
        cost: cost.toFixed(2),
        estimatedMinDays: rule.estimatedMinDays,
        estimatedMaxDays: rule.estimatedMaxDays,
        status: 'CALCULATED' as const,
      };
    });
  }
}
`);

const preview = 'apps/api/src/modules/checkout/services/checkout-preview.service.ts';

replaceRequired(
  preview,
  `    const estimatedTax = input.cart.summary.subtotal.mul(
      new Prisma.Decimal('0.05'),
    );`,
  `    // Não inventar imposto. Até existir motor fiscal configurado,
    // o checkout persiste zero e não cobra tributo estimado fictício.
    const estimatedTax = new Prisma.Decimal(0);`
);

replaceRequired(
  preview,
  `      estimatedTaxesSnapshot: {
        defaultTaxRate: '0.05',
        amount: estimatedTax.toString(),
      },`,
  `      estimatedTaxesSnapshot: {
        source: 'NOT_CONFIGURED',
        amount: estimatedTax.toString(),
      },`
);

const spec = 'apps/api/src/modules/checkout/services/checkout-preview.service.spec.ts';
if (fs.existsSync(path.join(ROOT, spec))) {
  replaceRequired(spec, `estimatedTaxAmount: '5',`, `estimatedTaxAmount: '0',`);
}

const view = 'src/components/CheckoutView.tsx';

replaceRequired(
  view,
  `import { useCreateOrder } from '../hooks/useOrders';`,
  `import { CheckoutApi } from '../api/clients/CheckoutApi';`
);

replaceRequired(
  view,
  `  const { items: cart, total: cartTotal, clearCart } = useCart();
  const { mutateAsync: createOrder } = useCreateOrder();`,
  `  const { items: cart, total: cartTotal, refreshCart } = useCart();`
);

replaceRequired(
  view,
  `    setIsProcessing(true);

    try {
      const newOrder = await createOrder({
        items: cart,
        total: grandTotal,
        paymentDetails: { method: paymentMethod as any, currency: selectedCurrency as any },
        status: 'confirmed',
      } as any);
      clearCart();
      setIsProcessing(false);
      const orderId = newOrder?.data?.id || 'ord_1001';
      navigate(\`/orders/\${orderId}/confirmation\`);
    } catch (err: any) {`,
  `    setIsProcessing(true);

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
      navigate(\`/orders/\${firstOrder.id}/confirmation\`);
    } catch (err: any) {`
);


replaceRequired(
  view,
  `  CreditCard,
  QrCode,
`,
  ``
);

replaceRequired(
  view,
  `  Smartphone,
`,
  ``
);

replaceRequired(
  view,
  `import { PaymentMethodType, DeliveryAddress, PaymentDetails, CountryCode } from '../types';`,
  `import { DeliveryAddress, CountryCode } from '../types';`
);

replaceRequired(
  view,
  `  // Payment State
  const countryPayments = countriesConfig[country]?.paymentMethods || ['orange_money', 'credit_card'];
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(countryPayments[0] as PaymentMethodType);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);`,
  `  const [isProcessing, setIsProcessing] = useState(false);`
);


for (const legacyLine of [
  "  const countryPayments = countriesConfig[country]?.paymentMethods || ['orange_money', 'credit_card'];\n",
  "  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(countryPayments[0] as PaymentMethodType);\n",
  "  const [phoneNumber, setPhoneNumber] = useState('');\n",
  "  const [cardNumber, setCardNumber] = useState('');\n",
  "  const [cardHolder, setCardHolder] = useState('');\n",
  "  const [cardExpiry, setCardExpiry] = useState('');\n",
  "  const [cardCvc, setCardCvc] = useState('');\n",
]) {
  const file = path.join(ROOT, view);
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(legacyLine)) {
    content = content.replace(legacyLine, '');
    fs.writeFileSync(file, content, 'utf8');
    console.log('OK', view, '(estado de pagamento legado removido)');
  }
}

const paymentBlockRegex = /          \{\/\* Step 2: Payment Methods \*\/\}[\s\S]*?          <\/div>\r?\n        <\/div>\r?\n\r?\n        \{\/\* Right Column/m;
const paymentReplacement = `          {/* Step 2: Payment Status */}
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

        {/* Right Column`;

replaceRegexRequired(
  view,
  paymentBlockRegex,
  paymentReplacement,
  'Nenhum PIN, cartão, CVV ou confirmação USSD'
);

console.log('Sprint 8.2.5 aplicada. Execute o checker e a validação completa.');
