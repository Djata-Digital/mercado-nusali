const fs = require('fs');

let failed = false;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const manifest = read('apps/api/src/modules/fulfillment/services/manifest.service.ts');
const shipping = read('apps/api/src/modules/fulfillment/services/shipping.service.ts');
const seller = read('src/components/SellerHubView.tsx');
const ordersApi = read('src/api/clients/OrdersApi.ts');

console.log('=== Sprint 8.5.2.4 — Manifest Response Sanitization Hotfix ===');

ok(
  'closeManifest sanitiza retorno',
  manifest.includes('return this.sanitizeManifestResponse(updated);')
);
ok(
  'dispatch idempotente sanitiza retorno',
  manifest.includes('if (manifest.status === ManifestStatus.DISPATCHED)') &&
  manifest.includes('return this.sanitizeManifestResponse(manifest);')
);
ok(
  'dispatch final sanitiza retorno',
  (manifest.match(/return this\.sanitizeManifestResponse\(updated\);/g) || []).length >= 2
);
ok(
  'getManifestById continua sanitizado',
  manifest.includes('return this.sanitizeManifestResponse(manifest);')
);
ok(
  'Sanitizer continua removendo shippingLabel.packingOrder',
  manifest.includes('const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;')
);
ok(
  'Shipment continua sanitizado',
  shipping.includes('return this.sanitizeShipmentResponse(shipment);')
);
ok(
  'Seller continua sem updateSellerStatus',
  !seller.includes('updateSellerStatus') && !ordersApi.includes('updateSellerStatus')
);

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.2.4: PASS');
