const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, content) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log('OK', rel);
}
function replaceRequired(rel, before, after, label = rel) {
  let s = read(rel);
  if (s.includes(after)) {
    console.log('OK', label, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) throw new Error(`Trecho esperado não encontrado: ${label}`);
  s = s.replace(before, after);
  write(rel, s);
}

console.log('=== Sprint 8.6.2 — Staging Deployment Readiness ===');

// 1) Storage readiness real.
replaceRequired(
  'apps/api/src/modules/storage/storage.service.ts',
  `  HeadObjectCommand,
  GetObjectCommand,`,
  `  HeadObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,`,
  'HeadBucketCommand'
);

replaceRequired(
  'apps/api/src/modules/storage/storage.service.ts',
  `  async objectExists(key: string, isPrivate = false): Promise<boolean> {`,
  `  async checkHealth(): Promise<boolean> {
    try {
      await Promise.all([
        this.s3Client.send(new HeadBucketCommand({ Bucket: this.publicBucket })),
        this.s3Client.send(new HeadBucketCommand({ Bucket: this.privateBucket })),
      ]);
      return true;
    } catch (error: any) {
      this.logger.warn(\`Object storage readiness failed: \${error.message}\`);
      return false;
    }
  }

  async objectExists(key: string, isPrivate = false): Promise<boolean> {`,
  'StorageService.checkHealth'
);

// 2) HealthController inclui object storage.
replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `import { RedisService } from '../redis/redis.service';`,
  `import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';`,
  'HealthController StorageService import'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `    private readonly redisService: RedisService,
  ) {}`,
  `    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
  ) {}`,
  'HealthController StorageService injection'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `    let dbStatus = 'down';
    let redisStatus = 'down';`,
  `    let dbStatus = 'down';
    let redisStatus = 'down';
    let storageStatus = 'down';`,
  'health storage status'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === 'ready') {
      redisStatus = 'up';
    }

    return {
      status: dbStatus === 'up' && redisStatus === 'up' ? 'ok' : 'degraded',`,
  `    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === 'ready') {
      redisStatus = 'up';
    }

    storageStatus = (await this.storageService.checkHealth()) ? 'up' : 'down';

    return {
      status:
        dbStatus === 'up' && redisStatus === 'up' && storageStatus === 'up'
          ? 'ok'
          : 'degraded',`,
  'health storage probe'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `        database: dbStatus,
        redis: redisStatus,
      },`,
  `        database: dbStatus,
        redis: redisStatus,
        objectStorage: storageStatus,
      },`,
  'health storage response'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `    let isDbReady = false;
    let isRedisReady = false;`,
  `    let isDbReady = false;
    let isRedisReady = false;
    let isStorageReady = false;`,
  'readiness storage flag'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === 'ready') {
      isRedisReady = true;
    }

    const isAllReady = isDbReady && isRedisReady;`,
  `    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === 'ready') {
      isRedisReady = true;
    }

    isStorageReady = await this.storageService.checkHealth();

    const isAllReady = isDbReady && isRedisReady && isStorageReady;`,
  'readiness storage check'
);

replaceRequired(
  'apps/api/src/modules/health/health.controller.ts',
  `          database: isDbReady ? 'up' : 'down',
          redis: isRedisReady ? 'up' : 'down',
        },`,
  `          database: isDbReady ? 'up' : 'down',
          redis: isRedisReady ? 'up' : 'down',
          objectStorage: isStorageReady ? 'up' : 'down',
        },`,
  'readiness storage response'
);

// 3) Docker image gets a real healthcheck.
replaceRequired(
  'apps/api/Dockerfile',
  `EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]`,
  `EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/' + (process.env.API_PREFIX || 'api/v1') + '/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]`,
  'Docker HEALTHCHECK'
);

// 4) Staging env example.
const stagingEnv = `# Mercado Nusali — STAGING
# Copie para .env.staging e substitua TODOS os placeholders.
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# URLs públicas HTTPS
PUBLIC_API_URL=https://api-staging.example.com
FRONTEND_URL=https://staging.example.com
CORS_ORIGIN=https://staging.example.com
TRUST_PROXY_HOPS=1
SWAGGER_ENABLED=false

# PostgreSQL gerenciado
DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:5432/mercado_nusali_staging?schema=public&sslmode=require

# Redis gerenciado
REDIS_HOST=REDIS_HOST
REDIS_PORT=6379
REDIS_PASSWORD=REDIS_PASSWORD

# Segurança
JWT_SECRET=REPLACE_WITH_RANDOM_64_CHAR_SECRET
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
LOGISTICS_ENCRYPTION_KEY=REPLACE_WITH_BASE64_32_BYTE_KEY

# S3/MinIO compatível
MINIO_ENDPOINT=STORAGE_HOST
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=STORAGE_ACCESS_KEY
MINIO_SECRET_KEY=STORAGE_SECRET_KEY
MINIO_PUBLIC_BUCKET=nusali-staging-public
MINIO_PRIVATE_BUCKET=nusali-staging-private

# Frontend build de staging
VITE_API_URL=https://api-staging.example.com/api/v1
VITE_UPLOAD_URL=https://api-staging.example.com/api/v1/upload
VITE_WEBSOCKET_URL=wss://api-staging.example.com
VITE_API_TIMEOUT_MS=15000
VITE_USE_FAKE_API=false
VITE_ENABLE_SELLER_PORTAL=true
VITE_ENABLE_ADMIN_PORTAL=true
VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES=false

# Payments: não habilite adaptadores simulados em staging de aceite.
PAYMENT_ALLOW_SIMULATED_PROVIDERS=false
`;
write('.env.staging.example', stagingEnv);

// 5) API-only staging compose: external DB/Redis/storage via env.
const compose = `services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    env_file:
      - .env.staging
    ports:
      - "\${API_BIND_PORT:-3000}:3000"
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/' + (process.env.API_PREFIX || 'api/v1') + '/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
`;
write('docker-compose.staging.yml', compose);

// 6) Env validator.
const envChecker = `const fs = require('fs');
const path = require('path');

const file = process.argv[2] || '.env.staging';
const full = path.resolve(process.cwd(), file);

if (!fs.existsSync(full)) {
  console.error('FAIL Arquivo de staging não encontrado: ' + file);
  process.exit(1);
}

const raw = fs.readFileSync(full, 'utf8');
const env = {};
for (const line of raw.split(/\\r?\\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx <= 0) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const errors = [];
const required = [
  'NODE_ENV','DATABASE_URL','REDIS_HOST','JWT_SECRET','LOGISTICS_ENCRYPTION_KEY',
  'MINIO_ENDPOINT','MINIO_ACCESS_KEY','MINIO_SECRET_KEY','CORS_ORIGIN',
  'PUBLIC_API_URL','FRONTEND_URL','VITE_API_URL','VITE_WEBSOCKET_URL'
];

for (const key of required) {
  if (!env[key]) errors.push(key + ' ausente.');
}

const joined = Object.values(env).join('\\n');
const placeholderPatterns = [
  /REPLACE_WITH_/i,
  /example\\.com/i,
  /(?:^|[=@/])DB_HOST(?:[:/?]|$)/i,
  /(?:^|[=@/])REDIS_HOST(?:[:/?]|$)/i,
  /STORAGE_HOST/i,
  /STORAGE_ACCESS_KEY/i,
  /STORAGE_SECRET_KEY/i,
  /REDIS_PASSWORD$/im,
];

for (const pattern of placeholderPatterns) {
  if (pattern.test(joined)) errors.push('Placeholder não substituído: ' + pattern);
}

for (const key of ['PUBLIC_API_URL','FRONTEND_URL','VITE_API_URL']) {
  if (env[key] && !env[key].startsWith('https://')) errors.push(key + ' deve usar HTTPS.');
}
if (env.VITE_WEBSOCKET_URL && !env.VITE_WEBSOCKET_URL.startsWith('wss://')) {
  errors.push('VITE_WEBSOCKET_URL deve usar WSS.');
}

if (env.NODE_ENV !== 'production') errors.push('NODE_ENV deve ser production no staging de aceite.');
if (env.CORS_ORIGIN?.includes('*')) errors.push('CORS_ORIGIN não pode conter wildcard.');
if (env.VITE_USE_FAKE_API !== 'false') errors.push('VITE_USE_FAKE_API deve ser false.');
if (env.VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES !== 'false') errors.push('Buyer experimental deve permanecer false.');
if (env.PAYMENT_ALLOW_SIMULATED_PROVIDERS !== 'false') errors.push('PAYMENT_ALLOW_SIMULATED_PROVIDERS deve ser false.');
if ((env.JWT_SECRET || '').length < 32) errors.push('JWT_SECRET precisa ter pelo menos 32 caracteres.');
if (env.JWT_SECRET?.includes('super-secret-jwt')) errors.push('JWT_SECRET de exemplo é proibido.');
if (env.MINIO_ACCESS_KEY === 'minioadmin' || env.MINIO_SECRET_KEY === 'minioadmin') errors.push('Credenciais MinIO padrão são proibidas.');
if (/(localhost|127\\.0\\.0\\.1)/i.test(env.DATABASE_URL || '')) errors.push('DATABASE_URL não pode apontar para localhost.');
if (/(localhost|127\\.0\\.0\\.1)/i.test(env.REDIS_HOST || '')) errors.push('REDIS_HOST não pode apontar para localhost.');
if (/(localhost|127\\.0\\.0\\.1)/i.test(env.MINIO_ENDPOINT || '')) errors.push('MINIO_ENDPOINT não pode apontar para localhost.');

console.log('=== Mercado Nusali Staging Environment Contract ===');
if (errors.length) {
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}
console.log('Staging Environment: PASS');
`;
write('tools/check-staging-env.cjs', envChecker);

// 7) Remote smoke test.
const smoke = `const baseArg = process.argv[2] || process.env.PUBLIC_API_URL;
if (!baseArg) {
  console.error('Uso: node tools/smoke-staging.cjs https://api-staging.seudominio.com');
  process.exit(1);
}
const base = baseArg.replace(/\\/$/, '');
if (!base.startsWith('https://')) {
  console.error('FAIL staging smoke exige HTTPS.');
  process.exit(1);
}
const apiPrefix = process.env.API_PREFIX || 'api/v1';

async function check(path, expected = 200) {
  const url = base + '/' + apiPrefix + path;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mercado-Nusali-Staging-Smoke/1.0' } });
  const text = await res.text();
  if (res.status !== expected) {
    throw new Error(path + ' retornou ' + res.status + ': ' + text.slice(0, 300));
  }
  console.log('OK', path, res.status);
  return text;
}

(async () => {
  console.log('=== Mercado Nusali Remote Staging Smoke ===');
  await check('/health/live');
  await check('/health/ready');
  await check('/public/stores');
  console.log('Remote Staging Smoke: PASS');
})().catch((error) => {
  console.error('FAIL', error.message);
  process.exit(1);
});
`;
write('tools/smoke-staging.cjs', smoke);

// 8) Release checklist docs.
const checklist = `# Mercado Nusali — Staging Release Checklist

## Antes do deploy
1. Copiar \`.env.staging.example\` para \`.env.staging\`.
2. Substituir todos os placeholders por secrets/hosts reais.
3. Executar:
   \`node tools/check-staging-env.cjs .env.staging\`
4. Executar a suíte local verde:
   \`npm run check:production:readiness\`
5. Aplicar migrations no banco de staging **uma única vez por release**:
   \`npm run db:deploy\`
6. Buildar e publicar a imagem da API.

## Depois do deploy
1. Confirmar \`/api/v1/health/live\`.
2. Confirmar \`/api/v1/health/ready\` (PostgreSQL + Redis + Object Storage).
3. Executar:
   \`node tools/smoke-staging.cjs https://api-staging.seudominio.com\`
4. Publicar frontend com as variáveis VITE_* do staging.
5. Fazer smoke manual Buyer → Seller → Admin → Fulfillment.
6. Só promover para produção depois de staging verde.

## Importante
Migrations não são executadas automaticamente no startup da API para evitar corrida entre réplicas.
`;
write('docs/STAGING-RELEASE-CHECKLIST.md', checklist);

// 9) package scripts.
{
  const rel = 'package.json';
  const pkg = JSON.parse(read(rel));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['check:staging:env'] = 'node tools/check-staging-env.cjs .env.staging';
  pkg.scripts['smoke:staging'] = 'node tools/smoke-staging.cjs';
  pkg.scripts['release:staging:preflight'] =
    'npm run lint && npm run build && npm run build:api && npm run check:frontend:production && npm run check:production:readiness && npm run check:staging:env';
  write(rel, JSON.stringify(pkg, null, 2) + '\n');
}

console.log('Sprint 8.6.2 aplicada. Execute checker e validação.');
