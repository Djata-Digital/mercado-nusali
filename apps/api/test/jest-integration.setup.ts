/**
 * Bootstrap comum para testes de integração PostgreSQL reais.
 *
 * Carrega .env.test.local / .env.test automaticamente antes dos arquivos de
 * teste, força Prisma a usar DATABASE_URL_TEST e protege contra execução
 * acidental em banco de desenvolvimento/produção.
 */
import * as fs from 'fs';
import * as path from 'path';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  const values: Record<string, string> = {};

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator <= 0) continue;

    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadTestEnv(): void {
  const apiRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(apiRoot, '.env.test'),
    path.join(apiRoot, '.env.test.local'),
  ];

  // .env.test.local tem precedência sobre .env.test, mas nunca sobrescreve
  // uma variável explicitamente exportada no terminal/CI.
  for (const filePath of candidates) {
    const values = parseEnvFile(filePath);
    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadTestEnv();

process.env.NODE_ENV = 'test';
process.env.LOGISTICS_ENCRYPTION_KEY =
  process.env.LOGISTICS_ENCRYPTION_KEY ||
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

const testDatabaseUrl = process.env.DATABASE_URL_TEST?.trim();

if (!testDatabaseUrl) {
  throw new Error(
    'DATABASE_URL_TEST não foi configurada. Copie apps/api/.env.test.example para apps/api/.env.test e ajuste usuário/senha do PostgreSQL.',
  );
}

if (!testDatabaseUrl.includes('_test')) {
  throw new Error(
    `Segurança de Dados: DATABASE_URL_TEST ("${testDatabaseUrl}") deve apontar para um banco cujo nome contenha "_test".`,
  );
}

// Serviços que usam PrismaService sem datasource explícito também ficam
// obrigatoriamente presos ao banco isolado de integração.
process.env.DATABASE_URL = testDatabaseUrl;

if (process.env.REDIS_URL_TEST) {
  process.env.REDIS_URL = process.env.REDIS_URL_TEST;
  delete process.env.DISABLE_BULLMQ_WORKERS;
} else {
  process.env.DISABLE_BULLMQ_WORKERS = 'true';
}
