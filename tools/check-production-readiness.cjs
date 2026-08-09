const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const errors = [];
const warnings = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const config = read('apps/api/src/config/configuration.ts');
const main = read('apps/api/src/main.ts');
const env = read('.env.example');
const app = read('src/App.tsx');
const seller = read('src/components/SellerHubView.tsx');
const admin = read('src/components/AdminDashboardView.tsx');
const fulfillment = read('src/components/admin/FulfillmentCoreView.tsx');

function requireText(source, text, message) {
  if (!source.includes(text)) errors.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) errors.push(message);
}

requireText(config, 'CORS_ORIGIN explícito e sem wildcard (*)', 'Backend não bloqueia CORS wildcard em produção.');
requireText(config, "minioAccessKey === 'minioadmin'", 'Backend não bloqueia credenciais MinIO padrão.');
requireText(config, 'LOGISTICS_ENCRYPTION_KEY é obrigatória em produção.', 'Chave logística não é fail-fast em produção.');
requireText(config, 'swagger:', 'Swagger não possui configuração por ambiente.');
requireText(main, 'if (swaggerEnabled)', 'Swagger ainda é registrado incondicionalmente.');
forbidText(main, "set('trust proxy', true)", 'trust proxy ainda confia em qualquer proxy.');
requireText(main, "set('trust proxy', trustProxyHops)", 'trust proxy não usa quantidade explícita de hops.');

requireText(env, 'VITE_USE_FAKE_API=false', 'Env exemplo não desativa fake API.');
requireText(env, 'VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES=false', 'Buyer experimental não está explicitamente desabilitado.');
requireText(env, 'SWAGGER_ENABLED=false', 'Env exemplo não desativa Swagger.');

for (const [name, source] of [['SellerHubView', seller], ['AdminDashboardView', admin], ['FulfillmentCoreView', fulfillment]]) {
  if (/from ['"].*(?:\/data\/mock|\/api\/fakeApi)/.test(source)) {
    errors.push(name + ' ainda importa mock/fake diretamente.');
  }
}

requireText(app, 'FRONTEND_FEATURES.SELLER_PORTAL', 'Seller portal não está feature-gated.');
requireText(app, 'FRONTEND_FEATURES.ADMIN_PORTAL', 'Admin portal não está feature-gated.');
requireText(app, 'FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES', 'Buyer experimental não está feature-gated.');

const oldMockFiles = [
  'src/components/admin/AdminFinanceDashboard.tsx',
  'src/components/admin/AdminRiskCenter.tsx',
  'src/components/admin/AdminSupportTickets.tsx',
];
for (const file of oldMockFiles) {
  if (fs.existsSync(path.join(ROOT, file))) {
    warnings.push(file + ' ainda existe como código legado, mas não pode ser importado pelo Admin Core.');
  }
}

console.log('=== Mercado Nusali Production Readiness Contract ===');
if (warnings.length) {
  console.log('\nWARNINGS:');
  warnings.forEach((w) => console.log('- ' + w));
}
if (errors.length) {
  console.error('\nERROS:');
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}
console.log('\nProduction Readiness: PASS');
