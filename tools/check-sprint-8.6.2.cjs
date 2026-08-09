const fs = require('fs');
let failed = false;
const read = p => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const health = read('apps/api/src/modules/health/health.controller.ts');
const storage = read('apps/api/src/modules/storage/storage.service.ts');
const dockerfile = read('apps/api/Dockerfile');
const compose = read('docker-compose.staging.yml');
const stagingEnv = read('.env.staging.example');
const envChecker = read('tools/check-staging-env.cjs');
const smoke = read('tools/smoke-staging.cjs');
const pkg = JSON.parse(read('package.json'));

console.log('=== Sprint 8.6.2 — Staging Deployment Readiness ===');
ok('StorageService possui health real', storage.includes('async checkHealth(): Promise<boolean>'));
ok('Storage health verifica buckets', storage.includes('HeadBucketCommand'));
ok('HealthController injeta StorageService', health.includes('private readonly storageService: StorageService'));
ok('Readiness inclui objectStorage', health.includes("objectStorage: isStorageReady ? 'up' : 'down'"));
ok('Readiness exige DB + Redis + Storage', health.includes('isDbReady && isRedisReady && isStorageReady'));
ok('Dockerfile possui HEALTHCHECK readiness', dockerfile.includes('/health/ready'));
ok('Compose staging não sobe Postgres local', !compose.includes('postgres:'));
ok('Compose staging não sobe Redis local', !compose.includes('redis:'));
ok('Compose staging usa .env.staging', compose.includes('.env.staging'));
ok('Staging env proíbe fake API', stagingEnv.includes('VITE_USE_FAKE_API=false'));
ok('Staging env proíbe simulated payments', stagingEnv.includes('PAYMENT_ALLOW_SIMULATED_PROVIDERS=false'));
ok('Staging env usa HTTPS/WSS', stagingEnv.includes('https://api-staging') && stagingEnv.includes('wss://api-staging'));
ok('Checker staging rejeita localhost', envChecker.includes("DATABASE_URL não pode apontar para localhost"));
ok('Checker staging rejeita placeholders', envChecker.includes('Placeholder não substituído'));
ok('Smoke remoto verifica live', smoke.includes("check('/health/live')"));
ok('Smoke remoto verifica ready', smoke.includes("check('/health/ready')"));
ok('Smoke remoto verifica catálogo público', smoke.includes("check('/public/stores')"));
ok('Package tem release preflight', Boolean(pkg.scripts?.['release:staging:preflight']));
ok('Package tem staging env check', pkg.scripts?.['check:staging:env'] === 'node tools/check-staging-env.cjs .env.staging');

if (failed) process.exit(1);
console.log('Contrato Sprint 8.6.2: PASS');
