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
  if (!s.includes(before)) {
    throw new Error(`Trecho esperado não encontrado: ${label}`);
  }
  s = s.replace(before, after);
  write(rel, s);
}

console.log('=== Sprint 8.6.1 — Production Guardrails ===');

// Backend environment validation.
replaceRequired(
  'apps/api/src/config/configuration.ts',
  `  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;`,
  `  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  const corsOrigin = process.env.CORS_ORIGIN;
  const redisHost = process.env.REDIS_HOST;
  const minioEndpoint = process.env.MINIO_ENDPOINT;
  const minioAccessKey = process.env.MINIO_ACCESS_KEY;
  const minioSecretKey = process.env.MINIO_SECRET_KEY;
  const logisticsEncryptionKey = process.env.LOGISTICS_ENCRYPTION_KEY;`,
  'variáveis críticas de produção'
);

replaceRequired(
  'apps/api/src/config/configuration.ts',
  `    if (process.env.DEMO_MODE === 'true') {
      logger.error('CRITICAL: DEMO_MODE cannot be enabled in production!');
      throw new Error('DEMO_MODE=true is strictly prohibited in production environments.');
    }
  }
}`,
  `    if (process.env.DEMO_MODE === 'true') {
      logger.error('CRITICAL: DEMO_MODE cannot be enabled in production!');
      throw new Error('DEMO_MODE=true is strictly prohibited in production environments.');
    }

    if (!corsOrigin || corsOrigin.split(',').map((v) => v.trim()).includes('*')) {
      logger.error('CRITICAL: CORS_ORIGIN precisa ser explícito em produção.');
      throw new Error('CORS_ORIGIN explícito e sem wildcard (*) é obrigatório em produção.');
    }

    if (!redisHost) {
      logger.error('CRITICAL: REDIS_HOST is missing in production!');
      throw new Error('REDIS_HOST é obrigatório em produção.');
    }

    if (!minioEndpoint || !minioAccessKey || !minioSecretKey) {
      logger.error('CRITICAL: Object storage configuration is incomplete in production!');
      throw new Error(
        'MINIO_ENDPOINT, MINIO_ACCESS_KEY e MINIO_SECRET_KEY são obrigatórios em produção.',
      );
    }

    if (minioAccessKey === 'minioadmin' || minioSecretKey === 'minioadmin') {
      logger.error('CRITICAL: Default MinIO credentials are forbidden in production!');
      throw new Error('Credenciais padrão minioadmin são proibidas em produção.');
    }

    if (!logisticsEncryptionKey) {
      logger.error('CRITICAL: LOGISTICS_ENCRYPTION_KEY is missing in production!');
      throw new Error('LOGISTICS_ENCRYPTION_KEY é obrigatória em produção.');
    }
  }
}`,
  'validação fail-fast de produção'
);

replaceRequired(
  'apps/api/src/config/configuration.ts',
  `    cors: {
      origin: (process.env.CORS_ORIGIN || '*').split(','),
    },
  };`,
  `    cors: {
      origin: (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
    swagger: {
      enabled:
        process.env.SWAGGER_ENABLED === 'true' ||
        (!isProd && process.env.SWAGGER_ENABLED !== 'false'),
    },
    trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS || '1', 10),
  };`,
  'config Swagger/proxy/CORS'
);

// main.ts: configurable trust proxy and Swagger disabled by default in prod.
replaceRequired(
  'apps/api/src/main.ts',
  `  const corsOrigins = configService.get<string[]>('cors.origin', ['*']);

  // Proxy Configuration
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);`,
  `  const corsOrigins = configService.get<string[]>('cors.origin', ['*']);
  const swaggerEnabled = configService.get<boolean>('swagger.enabled', false);
  const trustProxyHops = configService.get<number>('trustProxyHops', 1);

  // Proxy Configuration
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxyHops);`,
  'trust proxy explícito'
);

replaceRequired(
  'apps/api/src/main.ts',
  `  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mercado Nusali API')
    .setDescription(
      'Documentação da API de Fundação do Backend do Mercado Nusali (NestJS 11 + Prisma + PostgreSQL + Redis)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(\`🚀 Mercado Nusali API executando em: http://localhost:\${port}/\${apiPrefix}\`);
  logger.log(\`📚 Documentação Swagger disponível em: http://localhost:\${port}/docs\`);`,
  `  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mercado Nusali API')
      .setDescription(
        'Documentação da API de Fundação do Backend do Mercado Nusali (NestJS 11 + Prisma + PostgreSQL + Redis)',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  logger.log(\`🚀 Mercado Nusali API executando na porta \${port} com prefixo /\${apiPrefix}\`);
  if (swaggerEnabled) {
    logger.log(\`📚 Swagger habilitado em /docs\`);
  }`,
  'Swagger condicional'
);

// Document production variables in examples.
for (const rel of ['.env.example', 'apps/api/.env.example']) {
  let s = read(rel);
  if (!s.includes('SWAGGER_ENABLED=')) {
    s += `

# Production Security / Deployment
# Em production, CORS_ORIGIN deve listar apenas os domínios HTTPS do frontend.
# Exemplo: CORS_ORIGIN=https://mercado.nusali.com,https://www.mercado.nusali.com
SWAGGER_ENABLED=false
TRUST_PROXY_HOPS=1

# Production MUST use non-default credentials and explicit infrastructure.
# REDIS_HOST=redis.internal
# MINIO_ENDPOINT=storage.internal
# MINIO_ACCESS_KEY=<production-access-key>
# MINIO_SECRET_KEY=<production-secret-key>
# LOGISTICS_ENCRYPTION_KEY=<base64-32-byte-key>
`;
    write(rel, s);
  } else {
    console.log('OK', rel, '(já documentado)');
  }
}

// Frontend root env: core portals are now real, experimental buyer remains disabled.
{
  const rel = '.env.example';
  let s = read(rel);
  s = s.replace(
    `# Enquanto os portais não forem 100% convertidos para API real,
# mantenha-os false no build comercial.
VITE_ENABLE_SELLER_PORTAL=false
VITE_ENABLE_ADMIN_PORTAL=false
VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES=false`,
    `# Seller/Admin Core já usam contratos reais. Habilite-os no build comercial
# somente para os perfis operacionais que serão lançados.
VITE_ENABLE_SELLER_PORTAL=true
VITE_ENABLE_ADMIN_PORTAL=true

# Áreas Buyer auxiliares ainda não convertidas permanecem fechadas.
VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES=false`
  );
  write(rel, s);
}

// Add production readiness checker.
const checker = `const fs = require('fs');
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
  if (/from ['"].*(?:\\/data\\/mock|\\/api\\/fakeApi)/.test(source)) {
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
  console.log('\\nWARNINGS:');
  warnings.forEach((w) => console.log('- ' + w));
}
if (errors.length) {
  console.error('\\nERROS:');
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}
console.log('\\nProduction Readiness: PASS');
`;
write('tools/check-production-readiness.cjs', checker);

// package script.
{
  const rel = 'package.json';
  const pkg = JSON.parse(read(rel));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['check:production:readiness'] = 'node tools/check-production-readiness.cjs';
  write(rel, JSON.stringify(pkg, null, 2) + '\n');
}

console.log('Sprint 8.6.1 aplicada. Execute checker, builds e testes.');
