const fs = require('fs');
let failed = false;
const read = (p) => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const hub = read('src/components/SellerHubView.tsx');
const ordersApi = read('src/api/clients/OrdersApi.ts');

console.log('=== Sprint 8.4.2 — Seller Order Processing Real ===');
ok('Seller status usa PATCH /orders/:id/status', ordersApi.includes('`/orders/${id}/status`'));
ok('Seller só envia PREPARING ou READY_FOR_SHIPMENT', ordersApi.includes("'PREPARING' | 'READY_FOR_SHIPMENT'"));
ok('Frontend remove PROCESSING legado', !hub.includes("PROCESSING: 'Em preparação'"));
ok('Frontend remove READY_TO_SHIP legado', !hub.includes('READY_TO_SHIP'));
ok('PAID permite iniciar preparação', hub.includes("order.status === 'PAID'") && hub.includes("orderStatusAction(order.id, 'PREPARING')"));
ok('PREPARING permite pronto para expedição', hub.includes("order.status === 'PREPARING'") && hub.includes("orderStatusAction(order.id, 'READY_FOR_SHIPMENT')"));
ok('PENDING_PAYMENT não permite processamento', hub.includes('Aguardando pagamento'));
ok('READY_FOR_SHIPMENT transfere responsabilidade à logística', hub.includes('Aguardando logística'));
ok('Seller não marca SHIPPED manualmente', !hub.includes("orderStatusAction(order.id, 'SHIPPED')"));
ok('Seller não inventa tracking', !hub.includes('trackingCode') && !hub.includes('GW894'));
ok('UI explica fronteira Seller/logística', hub.includes('expedição/rastreamento pertencem à logística'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.4.2: PASS');
