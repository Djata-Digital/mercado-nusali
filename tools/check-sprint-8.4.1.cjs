const fs = require('fs');
let failed = false;
const read = (p) => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const dashboard = read('src/components/AdminDashboardView.tsx');
const api = read('src/api/clients/AdminCoreApi.ts');

console.log('=== Sprint 8.4.1 — Admin Core Real ===');
ok('AdminDashboard não importa painéis mockados antigos', !dashboard.includes("from './admin/AdminFinanceDashboard'") && !dashboard.includes("from './admin/AdminKycReview'"));
ok('Produtos admin usam /admin/products', api.includes("'/admin/products'"));
ok('Aprovação de produto é real', api.includes('`/admin/products/${id}/approve`'));
ok('Rejeição de produto é real', api.includes('`/admin/products/${id}/reject`'));
ok('KYC documents usa /admin/kyc/documents', api.includes("'/admin/kyc/documents'"));
ok('KYC seller approve é real', api.includes('`/admin/kyc/sellers/${sellerId}/approve`'));
ok('KYC seller reject é real', api.includes('`/admin/kyc/sellers/${sellerId}/reject`'));
ok('Lista real de sellers usa /sellers', api.includes("'/sellers'"));
ok('Auditoria usa /audit-logs', api.includes("'/audit-logs'"));
ok('Dashboard não inventa risco IA', !dashboard.includes('98,4%') && !dashboard.includes('Risco IA'));
ok('Dashboard não inventa financeiro', !dashboard.includes('GMV') && !dashboard.includes('Nusali Pay & Gateways'));
ok('Dashboard informa módulos não reais fora do core', dashboard.includes('continuam fora deste Admin Core'));
ok('Aprovação KYC explica validação backend', dashboard.includes('documentos mínimos do backend'));
ok('Ações invalidam auditoria real', dashboard.includes("'admin-core-audit'"));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.4.1: PASS');
