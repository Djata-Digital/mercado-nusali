const fs = require('fs');
function read(p) { return fs.readFileSync(p, 'utf8'); }
let failed = false;
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const api = read('src/api/clients/OrdersApi.ts');
const service = read('src/services/orderService.ts');
const hooks = read('src/hooks/useOrders.ts');
const list = read('src/components/MyOrdersView.tsx');
const detail = read('src/components/OrderDetailView.tsx');
const confirmation = read('src/components/OrderConfirmationView.tsx');
const tracking = read('src/components/TrackingView.tsx');
const detailPage = read('src/pages/OrderDetailPage.tsx');
const trackingPage = read('src/pages/TrackingPage.tsx');
const context = read('src/context/MarketplaceContext.tsx');

ok('Buyer lista /orders/my-orders', api.includes("'/orders/my-orders'"));
ok('Buyer detalhe /orders/:id', api.includes("`/orders/${id}`"));
ok('Buyer tracking /orders/:orderId/tracking', api.includes("`/orders/${orderId}/tracking`"));
ok('OrderService não usa fakeApi', !service.includes('fakeApi') && !service.includes('USE_FAKE_API'));
ok('Hooks usam buyer orders reais', hooks.includes("queryKey: ['buyer-orders']") && hooks.includes('getOrderTracking'));
ok('MyOrders não usa trackingCode fictício', !list.includes('GW8941203892NSL') && !list.includes('NSL-'));
ok('Detail não usa MarketplaceContext activeOrder', !detail.includes('useMarketplace') && !detail.includes('activeOrder'));
ok('Confirmation não usa MarketplaceContext activeOrder', !confirmation.includes('useMarketplace') && !confirmation.includes('activeOrder'));
ok('Tracking não usa MarketplaceContext activeOrder', !tracking.includes('useMarketplace') && !tracking.includes('activeOrder'));
ok('Tracking não possui fallback de código fictício', !tracking.includes('GW8941203892NSL') && !tracking.includes('NUS-SIMULATED'));
ok('OrderDetailPage renderiza OrderDetailView', detailPage.includes('<OrderDetailView'));
ok('TrackingPage renderiza TrackingView', trackingPage.includes('<TrackingView'));
ok('Confirmação exige id real da rota', confirmation.includes("useParams()"));
ok('Listagem usa orderNumber real', list.includes('order.orderNumber'));
ok('Detalhe exibe snapshots persistidos', detail.includes('addressSnapshotRelation') && detail.includes('productTitleSnapshot'));
ok('Tracking ausente não é simulado', tracking.includes('Rastreamento ainda não disponível'));
ok('Mock legado pode permanecer isolado no contexto, mas não alimenta Buyer Orders', context.includes('activeOrder') && !detail.includes('activeOrder') && !tracking.includes('activeOrder'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.6: PASS');
