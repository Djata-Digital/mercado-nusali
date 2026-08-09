const fs = require('fs');
let failed = false;
const read = (p) => fs.readFileSync(p, 'utf8');
const check = (name, value) => {
  console.log(`${value ? 'OK' : 'FAIL'} ${name}`);
  if (!value) failed = true;
};

const seller = read('src/components/SellerHubView.tsx');
const ordersApi = read('src/api/clients/OrdersApi.ts');
const shipping = read('apps/api/src/modules/fulfillment/services/shipping.service.ts');
const manifest = read('apps/api/src/modules/fulfillment/services/manifest.service.ts');

console.log('=== Sprint 8.5.2.2 — Fulfillment Circular Response + Seller Boundary Hotfix ===');
check('SellerHub não referencia updateSellerStatus', !seller.includes('updateSellerStatus'));
check('SellerHub não possui orderStatusAction legado', !seller.includes('const orderStatusAction'));
check('OrdersApi continua sem updateSellerStatus', !ordersApi.includes('updateSellerStatus'));
check('Shipment remove back-reference shippingLabel.packingOrder', shipping.includes('private sanitizeShipmentResponse'));
check('getShipmentById devolve resposta sanitizada', shipping.includes('return this.sanitizeShipmentResponse(shipment);'));
check('Manifest remove back-reference shippingLabel.packingOrder', manifest.includes('private sanitizeManifestResponse'));
check('getManifestById devolve resposta sanitizada', manifest.includes('return this.sanitizeManifestResponse(manifest);'));
check('Tracking real da ShippingLabel permanece', shipping.includes('const trackingCode = shippingLabel.trackingNumber;'));
check('Shipment continua exigindo ShippingLabel válida', shipping.includes('if (!shippingLabel || shippingLabel.isInvalidated)'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.2.2: PASS');
