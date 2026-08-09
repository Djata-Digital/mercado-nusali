const fs = require('fs');
function read(p) { return fs.readFileSync(p, 'utf8'); }
let failed = false;
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const view = read('src/components/CheckoutView.tsx');
const preview = read('apps/api/src/modules/checkout/services/checkout-preview.service.ts');
const shipping = read('apps/api/src/modules/checkout/shipping/shipping-calculation.service.ts');
const api = read('src/api/clients/CheckoutApi.ts');

ok('Frontend usa POST /checkout/session', api.includes("'/checkout/session'") && view.includes('CheckoutApi.createSession(selectedAddressId)'));
ok('Frontend usa POST /checkout/confirm', api.includes("'/checkout/confirm'") && view.includes('CheckoutApi.confirm('));
ok('createOrder legado saiu do checkout', !view.includes('useCreateOrder') && !view.includes('createOrder({'));
ok('Frontend não envia total ao confirmar checkout', !/CheckoutApi\.confirm\([\s\S]{0,300}\btotal\b/m.test(view));
ok('Frontend envia apenas storeId/serviceCode no frete', view.includes('serviceCode: entry.option.serviceCode'));
ok('Pedido real exige orderGroup e order persistido', view.includes('confirmed?.orderGroup?.id') && view.includes('firstOrder?.id'));
ok('Carrinho é atualizado do servidor após confirmação', view.includes('await refreshCart()'));
ok('Checkout não simula USSD', !view.includes('Você receberá um prompt USSD'));
ok('Checkout não coleta cartão/CVV', !view.includes('cardNumber') && !view.includes('cardCvc') && !view.includes('Número do Cartão'));
ok('Checkout informa PENDING_PAYMENT sem pagamento falso', view.includes('aguardando pagamento'));
ok('Imposto fixo de 5% removido do backend', !preview.includes("new Prisma.Decimal('0.05')") && !preview.includes("defaultTaxRate: '0.05'"));
ok('Shipping checkout usa ShippingRateRule', shipping.includes('shippingRateRule.findMany'));
ok('Shipping checkout filtra moeda do carrinho', shipping.includes('currencyId: request.currencyId'));
ok('Shipping checkout usa Prisma.Decimal', shipping.includes('new Prisma.Decimal(rule.baseAmount)'));
ok('Shipping checkout não usa provider simulado', !shipping.includes('const baseCost = 15.0') && !shipping.includes('const baseCost = 18.0'));
ok('Shipping checkout não possui fallback fixo', !shipping.includes("providerCode: 'FALLBACK'") && !shipping.includes('cost: 20.0'));
ok('Sem tarifa real bloqueia checkout', shipping.includes('CHECKOUT_SHIPPING_RATE_NOT_CONFIGURED'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.5: PASS');
