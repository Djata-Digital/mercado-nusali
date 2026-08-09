const fs = require('fs');
let failed = false;
const read = p => fs.readFileSync(p, 'utf8');
const ok = (label, value) => {
  console.log(`${value ? 'OK' : 'FAIL'} ${label}`);
  if (!value) failed = true;
};

const api = read('src/api/clients/FulfillmentOpsApi.ts');
const ui = read('src/components/admin/FulfillmentCoreView.tsx');
const admin = read('src/components/AdminDashboardView.tsx');
const label = read('apps/api/src/modules/fulfillment/services/label.service.ts');
const manifest = read('apps/api/src/modules/fulfillment/services/manifest.service.ts');

console.log('=== Sprint 8.5.3 — Fulfillment Core Operational Real ===');
ok('Admin Core inclui Fulfillment real', admin.includes("<FulfillmentCoreView showToast={setMessage} />"));
ok('Fila usa pedidos PAID reais', api.includes("status: 'PAID'") && api.includes("'/orders/admin'"));
ok('Geração de picking usa endpoint real', api.includes('`/fulfillment/picking/order/${orderId}/generate`'));
ok('Picking start real', api.includes('`/fulfillment/picking/${id}/start`'));
ok('Picking items real', api.includes('`/fulfillment/picking/${id}/items`'));
ok('Packing start real', api.includes("'/fulfillment/packing/start'"));
ok('Packing complete real', api.includes('`/fulfillment/packing/${id}/complete`'));
ok('Label real', api.includes('`/fulfillment/packing/${id}/label`'));
ok('Shipment real', api.includes("'/fulfillment/shipping'"));
ok('Manifest create/close/dispatch reais', api.includes("'/fulfillment/manifests'") && api.includes('/close') && api.includes('/dispatch'));
ok('UI confirma picking físico antes de concluir', ui.includes('Confirmar separação física COMPLETA'));
ok('UI exige peso/dimensões reais', ui.includes('Peso bruto REAL') && ui.includes('Largura REAL'));
ok('UI exige transportadora na etiqueta', ui.includes('Nome REAL da transportadora responsável'));
ok('UI confirma despacho físico', ui.includes('CONFIRMAR saída física'));
ok('Backend label não usa Mercado Nusali Express fallback', !label.includes("dto.carrierName || 'Mercado Nusali Express'"));
ok('Backend label exige carrierName', label.includes('carrierName) é obrigatório'));
ok('Backend manifest não usa Transportes Nusali fallback', !manifest.includes("dto.carrierName || 'Transportes Nusali'"));
ok('Backend manifest exige carrierName', manifest.includes('carrierName) é obrigatório no romaneio'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.3: PASS');
