const fs = require('fs');

let failed = false;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const shipping = read('apps/api/src/modules/fulfillment/services/shipping.service.ts');
const manifest = read('apps/api/src/modules/fulfillment/services/manifest.service.ts');
const seller = read('src/components/SellerHubView.tsx');
const ordersApi = read('src/api/clients/OrdersApi.ts');

console.log('=== Sprint 8.5.2.3 — Sanitizer Type Hotfix ===');

ok('Shipment sanitizer usa any estrutural', shipping.includes('private sanitizeShipmentResponse(shipment: any): any'));
ok('Manifest sanitizer usa any estrutural', manifest.includes('private sanitizeManifestResponse(manifest: any): any'));
ok('Shipment sanitizer continua removendo back-reference', shipping.includes('const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;'));
ok('Manifest sanitizer continua removendo back-reference', manifest.includes('const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;'));
ok('Shipment continua usando resposta sanitizada', shipping.includes('return this.sanitizeShipmentResponse(shipment);'));
ok('Manifest continua usando resposta sanitizada', manifest.includes('return this.sanitizeManifestResponse(manifest);'));
ok('SellerHub continua sem updateSellerStatus', !seller.includes('updateSellerStatus'));
ok('OrdersApi continua sem updateSellerStatus', !ordersApi.includes('updateSellerStatus'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.2.3: PASS');
