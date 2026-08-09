const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function copy(rel) {
  const src = path.join(__dirname, '..', 'payload', rel);
  const dst = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('OK', rel);
}

console.log('=== Sprint 8.2.6 — Buyer Orders + Tracking Real ===');

[
  'src/api/clients/OrdersApi.ts',
  'src/services/orderService.ts',
  'src/hooks/useOrders.ts',
  'src/components/MyOrdersView.tsx',
  'src/components/OrderDetailView.tsx',
  'src/components/OrderConfirmationView.tsx',
  'src/components/TrackingView.tsx',
  'src/pages/OrderDetailPage.tsx',
  'src/pages/OrderConfirmationPage.tsx',
  'src/pages/TrackingPage.tsx',
].forEach(copy);

// O detalhe real precisa de moeda no payload; o serviço já possui ownership.
// Adicionamos carrier em shippingRelation para exibição segura sem novo endpoint.
const orderServiceFile = path.join(ROOT, 'apps/api/src/modules/orders/orders.service.ts');
let s = fs.readFileSync(orderServiceFile, 'utf8');

if (!s.includes("shippingRelation: { include: { carrier: true } }")) {
  s = s.replace(
    "shippingRelation: true,\n        couponRelation: true,",
    "shippingRelation: { include: { carrier: true } },\n        couponRelation: true,"
  );
  s = s.replace(
    "store: true,\n        seller: true,\n        currency: true,",
    "store: true,\n        seller: true,\n        currency: true,"
  );
  fs.writeFileSync(orderServiceFile, s, 'utf8');
  console.log('OK apps/api/src/modules/orders/orders.service.ts');
} else {
  console.log('OK apps/api/src/modules/orders/orders.service.ts (já aplicado)');
}

// Remove rota genérica sem :id, que não tem confirmação real associada.
const appFile = path.join(ROOT, 'src/App.tsx');
let app = fs.readFileSync(appFile, 'utf8');
const legacyRoute = '                    <Route path="/orders/confirmation" element={<OrderConfirmationPage />} />\\n';
if (app.includes(legacyRoute)) {
  app = app.replace(legacyRoute, '');
  fs.writeFileSync(appFile, app, 'utf8');
  console.log('OK src/App.tsx rota confirmation sem id removida');
} else {
  console.log('OK src/App.tsx rota confirmation sem id já ausente');
}

console.log('Sprint 8.2.6 aplicada. Execute checker, lint, builds e testes.');
