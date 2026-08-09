const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function replaceRequired(rel, before, after) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(after)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) {
    throw new Error(`Trecho esperado não encontrado em ${rel}`);
  }
  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.5.2.1 — Nullability + Seller Status Hotfix ===');

// 1) Tornar o narrowing explícito e estável para o TypeScript.
replaceRequired(
  'apps/api/src/modules/fulfillment/services/shipping.service.ts',
  `    if (!packingOrder.shippingLabel || packingOrder.shippingLabel.isInvalidated) {
      throw new BadRequestException(
        'Uma ShippingLabel válida precisa existir antes de criar o Shipment.',
      );
    }

    const existing = await this.prisma.shipment.findUnique({`,
  `    const shippingLabel = packingOrder.shippingLabel;

    if (!shippingLabel || shippingLabel.isInvalidated) {
      throw new BadRequestException(
        'Uma ShippingLabel válida precisa existir antes de criar o Shipment.',
      );
    }

    const existing = await this.prisma.shipment.findUnique({`
);

replaceRequired(
  'apps/api/src/modules/fulfillment/services/shipping.service.ts',
  `      const trackingCode = packingOrder.shippingLabel.trackingNumber;`,
  `      const trackingCode = shippingLabel.trackingNumber;`
);

// 2) Remover definitivamente updateSellerStatus, inclusive se o regex anterior não pegou.
const ordersApiPath = path.join(ROOT, 'src/api/clients/OrdersApi.ts');
let ordersApi = fs.readFileSync(ordersApiPath, 'utf8');

const before = ordersApi;
ordersApi = ordersApi.replace(
  /\n\s*static\s+updateSellerStatus\s*\([\s\S]*?\n\s*\}\n(?=\s*\})/m,
  '\n'
);

// fallback mais específico caso o método esteja em outro formato.
ordersApi = ordersApi.replace(
  /\n\s*static\s+updateSellerStatus\s*\([\s\S]*?return\s+apiClient\.patch\([\s\S]*?\);\s*\n\s*\}\s*/m,
  '\n'
);

if (ordersApi.includes('updateSellerStatus')) {
  throw new Error('Não foi possível remover updateSellerStatus de OrdersApi.ts');
}

if (ordersApi !== before) {
  fs.writeFileSync(ordersApiPath, ordersApi, 'utf8');
  console.log('OK src/api/clients/OrdersApi.ts updateSellerStatus removido');
} else {
  console.log('OK src/api/clients/OrdersApi.ts updateSellerStatus já ausente');
}

console.log('Hotfix Sprint 8.5.2.1 aplicado.');
