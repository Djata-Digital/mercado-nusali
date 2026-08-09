const fs = require('fs');
let failed = false;
const read = p => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const config = read('apps/api/src/config/configuration.ts');
const main = read('apps/api/src/main.ts');
const env = read('.env.example');
const pkg = JSON.parse(read('package.json'));
const prodChecker = read('tools/check-production-readiness.cjs');

console.log('=== Sprint 8.6.1 — Production Guardrails ===');
ok('Production bloqueia CORS wildcard', config.includes('CORS_ORIGIN explícito e sem wildcard (*)'));
ok('Production exige Redis explícito', config.includes('REDIS_HOST é obrigatório em produção.'));
ok('Production exige object storage explícito', config.includes('MINIO_ENDPOINT, MINIO_ACCESS_KEY e MINIO_SECRET_KEY'));
ok('Production bloqueia minioadmin', config.includes("minioAccessKey === 'minioadmin'"));
ok('Production exige logistics encryption key', config.includes('LOGISTICS_ENCRYPTION_KEY é obrigatória em produção.'));
ok('Swagger é configurável', config.includes('swagger:') && main.includes('if (swaggerEnabled)'));
ok('Swagger não é sempre exposto', !main.includes("SwaggerModule.setup('docs', app, document);\n\n  await app.listen"));
ok('trust proxy não usa true global', !main.includes("set('trust proxy', true)"));
ok('trust proxy usa hops configuráveis', main.includes("set('trust proxy', trustProxyHops)"));
ok('Env desativa Swagger', env.includes('SWAGGER_ENABLED=false'));
ok('Env habilita Seller Core real', env.includes('VITE_ENABLE_SELLER_PORTAL=true'));
ok('Env habilita Admin Core real', env.includes('VITE_ENABLE_ADMIN_PORTAL=true'));
ok('Buyer experimental permanece fechado', env.includes('VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES=false'));
ok('Checker production readiness existe', prodChecker.includes('Production Readiness: PASS'));
ok('Package possui check:production:readiness', pkg.scripts?.['check:production:readiness'] === 'node tools/check-production-readiness.cjs');

if (failed) process.exit(1);
console.log('Contrato Sprint 8.6.1: PASS');
