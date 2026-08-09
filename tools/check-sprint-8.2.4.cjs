const fs = require('fs');

function read(p) { return fs.readFileSync(p, 'utf8'); }
let failed = false;
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const addressesView = read('src/components/AddressesView.tsx');
const checkout = read('src/components/CheckoutView.tsx');
const shippingService = read('apps/api/src/modules/shipping-quotes/shipping-quotes.service.ts');

ok('AddressesView usa API real', addressesView.includes('AddressesApi.list()') && addressesView.includes('AddressesApi.create(payload)'));
ok('Endereços fictícios Alex Silva removidos', !addressesView.includes('Alex Silva'));
ok('Checkout não inicia com endereço fictício', !checkout.includes("recipientName: 'Alex Silva'"));
ok('Checkout não inicia com cartão fictício', !checkout.includes("4532 •••• •••• 8892"));
ok('Frete fixo 2500 removido do checkout', !checkout.includes('shippingFee = cart.every') && !checkout.includes(': 2500'));
ok('Tributo fictício de 8% removido', !checkout.includes('cartTotal * 0.08'));
ok('Falha de pedido preserva o carrinho', !/catch\s*\([^)]*\)\s*\{[\s\S]{0,160}clearCart\(\)/m.test(checkout));
ok('Checkout consulta shipping quote real', checkout.includes('ShippingQuotesApi.calculate(selectedAddressId)'));
ok('Shipping quote usa ShippingRateRule', shippingService.includes('shippingRateRule.findMany'));
ok('Shipping quote não usa INTERNAL_SIMULATION', !shippingService.includes('INTERNAL_SIMULATION'));
ok('Shipping quote não cria tarifa hard-coded', !shippingService.includes('new Prisma.Decimal(5000)') && !shippingService.includes('new Prisma.Decimal(1500)'));
ok('Sem fallback silencioso de frete', shippingService.includes('Nenhuma tarifa de frete ativa foi configurada'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.4: PASS');
