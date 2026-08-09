const fs = require('fs');

let failed = false;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const shipping = read('apps/api/src/modules/fulfillment/services/shipping.service.ts');
const ordersApi = read('src/api/clients/OrdersApi.ts');
const seller = read('src/components/SellerHubView.tsx');

console.log('=== Sprint 8.5.2.1 — Nullability + Seller Status Hotfix ===');

ok('ShippingLabel é copiada para variável local', shipping.includes('const shippingLabel = packingOrder.shippingLabel;'));
ok('ShippingLabel local é validada antes do uso', shipping.includes('if (!shippingLabel || shippingLabel.isInvalidated)'));
ok('Tracking usa shippingLabel local', shipping.includes('const trackingCode = shippingLabel.trackingNumber;'));
ok('Tracking não usa acesso nullable direto', !shipping.includes('packingOrder.shippingLabel.trackingNumber'));
ok('OrdersApi não possui updateSellerStatus', !ordersApi.includes('updateSellerStatus'));
ok('SellerHub não chama updateSellerStatus', !seller.includes('updateSellerStatus'));
ok('SellerHub não avança READY_FOR_SHIPMENT manualmente', !seller.includes("orderStatusAction(order.id, 'READY_FOR_SHIPMENT')"));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.2.1: PASS');
