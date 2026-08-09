/**
 * Prepara o PostgreSQL de integração uma única vez antes da suíte Jest.
 *
 * Importante:
 * - usa exclusivamente DATABASE_URL_TEST;
 * - exige "_test" no nome do banco para reduzir risco de apontar para produção;
 * - executa Prisma CLI com o próprio Node, sem npx.cmd/shell, garantindo
 *   compatibilidade entre Windows, Linux e CI.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};

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

function loadTestEnvironment(apiRoot) {
  // Variáveis já exportadas no terminal/CI têm prioridade sobre arquivos locais.
  for (const fileName of ['.env.test', '.env.test.local']) {
    const values = parseEnvFile(path.join(apiRoot, fileName));

    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function assertSafeTestDatabase(dbUrlTest) {
  if (!dbUrlTest) {
    throw new Error(
      'DATABASE_URL_TEST não foi configurada. Crie apps/api/.env.test a partir de .env.test.example.',
    );
  }

  let databaseName = '';

  try {
    const parsed = new URL(dbUrlTest);
    databaseName = parsed.pathname.replace(/^\//, '').split('/')[0];
  } catch {
    throw new Error('DATABASE_URL_TEST possui uma URL PostgreSQL inválida.');
  }

  if (!databaseName.toLowerCase().includes('_test')) {
    throw new Error(
      `Segurança de Dados: o banco de DATABASE_URL_TEST deve conter "_test" no nome. Banco recebido: "${databaseName || 'desconhecido'}".`,
    );
  }
}

function resolvePrismaCli(apiRoot) {
  try {
    // Resolve também quando node_modules está no root do monorepo.
    return require.resolve('prisma/build/index.js', { paths: [apiRoot] });
  } catch (error) {
    throw new Error(
      `Prisma CLI não foi encontrado a partir de ${apiRoot}. Execute npm install na raiz do projeto antes dos testes de integração. Motivo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

module.exports = async () => {
  const apiRoot = path.resolve(__dirname, '..');
  loadTestEnvironment(apiRoot);

  const dbUrlTest = (process.env.DATABASE_URL_TEST || '').trim();
  assertSafeTestDatabase(dbUrlTest);

  // Todos os processos filhos e o Prisma Client devem usar o banco isolado.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = dbUrlTest;

  const prismaCli = resolvePrismaCli(apiRoot);

  console.log('[INTEGRATION SETUP] Aplicando migrations no PostgreSQL isolado de teste...');

  try {
    execFileSync(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--schema=prisma/schema.prisma'],
      {
        cwd: apiRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: dbUrlTest,
        },
      },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Falha ao aplicar migrations no DATABASE_URL_TEST. Confirme que o PostgreSQL está ativo, que o banco de teste existe e que usuário/senha estão corretos. Detalhes: ${details}`,
    );
  }

  console.log('[INTEGRATION SETUP] Migrations aplicadas com sucesso.');
};
