const fs = require('fs');
const path = require('path');

const file = process.argv[2] || '.env.staging';
const full = path.resolve(process.cwd(), file);

if (!fs.existsSync(full)) {
  console.error('FAIL Arquivo de staging não encontrado: ' + file);
  process.exit(1);
}

const raw = fs.readFileSync(full, 'utf8');
const env = {};
for (const line of raw.split(/\r?\n/)) {
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

const joined = Object.values(env).join('\n');
const placeholderPatterns = [
  /REPLACE_WITH_/i,
  /example\.com/i,
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
if (/(localhost|127\.0\.0\.1)/i.test(env.DATABASE_URL || '')) errors.push('DATABASE_URL não pode apontar para localhost.');
if (/(localhost|127\.0\.0\.1)/i.test(env.REDIS_HOST || '')) errors.push('REDIS_HOST não pode apontar para localhost.');
if (/(localhost|127\.0\.0\.1)/i.test(env.MINIO_ENDPOINT || '')) errors.push('MINIO_ENDPOINT não pode apontar para localhost.');

console.log('=== Mercado Nusali Staging Environment Contract ===');
if (errors.length) {
  errors.forEach((e) => console.error('- ' + e));
  process.exit(1);
}
console.log('Staging Environment: PASS');
