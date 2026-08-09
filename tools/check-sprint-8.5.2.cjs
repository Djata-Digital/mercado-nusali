const fs = require('fs');
let failed = false;
const read = p => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const controller = read('apps/api/src/modules/orders/orders.controller.ts');
const service = read('apps/api/src/modules/orders/orders.service.ts');
const seller = read('src/components/SellerHubView.tsx');
const ordersApi = read('src/api/clients/OrdersApi.ts');
const shipping = read('apps/api/src/modules/fulfillment/services/shipping.service.ts');
const e2e = read('apps/api/test/sprint5-2-fulfillment.e2e-spec.ts');

console.log('=== Sprint 8.5.2 — Orders AuthZ + Fulfillment Boundary Hardening ===');
ok('GET /orders/admin exige RolesGuard', controller.includes("@Roles('ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS', 'SUPPORT')"));
ok('PATCH /orders/:id/status exige role operacional', controller.includes("@Roles('ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS')"));
ok('Seller storeId valida ownership/membership', service.includes("Acesso negado aos pedidos desta loja."));
ok('Seller storeId não é aplicado antes da validação', service.indexOf("Acesso negado aos pedidos desta loja.") < service.indexOf("where.storeId = storeId"));
ok('Comentários verificam acesso ao pedido', service.includes('findOne(orderId, currentUser)'));
ok('Anexos verificam acesso ao pedido', (service.match(/findOne\(orderId, currentUser\)/g) || []).length >= 2);
ok('Seller não possui updateSellerStatus', !ordersApi.includes('updateSellerStatus'));
ok('Seller não avança READY_FOR_SHIPMENT manualmente', !seller.includes("orderStatusAction(order.id, 'READY_FOR_SHIPMENT')"));
ok('Seller informa que fulfillment controla status', seller.includes('atualizados pelo fulfillment/logística'));
ok('Shipment exige ShippingLabel válida', shipping.includes('Uma ShippingLabel válida precisa existir antes de criar o Shipment.'));
ok('Shipment não cria TRK fallback', !shipping.includes('`TRK-${shipmentCode}`'));
ok('Shipment usa tracking da etiqueta', shipping.includes('packingOrder.shippingLabel.trackingNumber'));
ok('E2E cria shipment com etiqueta válida', e2e.includes('mockPackingOrder.shippingLabel = mockShippingLabel'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.2: PASS');
