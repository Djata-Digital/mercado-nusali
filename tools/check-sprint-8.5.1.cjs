const fs = require('fs');
let failed = false;
const read = (p) => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const ui = read('src/components/admin/AdminLogisticsDashboard.tsx');
const api = read('src/api/clients/AdminLogisticsApi.ts');

console.log('=== Sprint 8.5.1 — Admin Logistics Dashboard Real ===');
ok('Dashboard não importa mockAdminLogistics', !ui.includes('mockAdminLogistics'));
ok('Dashboard não usa mockLogisticsShipmentsList', !ui.includes('mockLogisticsShipmentsList'));
ok('Cliente usa GET /fulfillment/shipping', api.includes("'/fulfillment/shipping'"));
ok('Cliente usa GET /admin/tracking', api.includes("'/admin/tracking'"));
ok('Expedições usam status reais do Prisma', ui.includes('READY_TO_SHIP') && ui.includes('WAITING_CARRIER'));
ok('Tracking usa status reais', ui.includes('CUSTOMS_PENDING') && ui.includes('OUT_FOR_DELIVERY') && ui.includes('DELIVERED'));
ok('Atualizar executa refetch real', ui.includes('await shipmentsQuery.refetch()') && ui.includes('await trackingsQuery.refetch()'));
ok('Dashboard não inventa cidade de origem/destino', !ui.includes('originCity') && !ui.includes('destCity'));
ok('Dashboard não inventa remetente/destinatário', !ui.includes('senderName') && !ui.includes('recipientName'));
ok('Dashboard não inventa prazo de entrega', !ui.includes('estimatedDeliveryDate'));
ok('Dashboard não inventa peso formatado', !ui.includes('weightFormatted'));
ok('Tela declara que não simula dados', ui.includes('Nenhum envio, transportadora ou prazo é simulado'));
ok('Operações sensíveis permanecem fora do dashboard', !ui.includes('overrideAdminTrackingStatus') && !ui.includes('dispatchShipment('));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.1: PASS');
