const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const API = path.join(ROOT, 'apps', 'api');

if (!fs.existsSync(API)) {
  throw new Error(
    'apps/api não encontrado. Execute este script na raiz de mercado-nusali.',
  );
}

function walk(dir, predicate) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (entry.isFile() && predicate(full)) out.push(full);
  }
  return out;
}

function writeIfChanged(file, before, after, label) {
  if (before === after) return false;
  fs.writeFileSync(file, after, 'utf8');
  console.log(`[Sprint 8.1.1] ${label}: ${path.relative(ROOT, file)}`);
  return true;
}

/**
 * 1) Normaliza TODO decorator de rota.
 *
 * A Sprint 8.1 normalizou os @Controller principais, mas os controllers
 * logísticos antigos carregavam "api/v1" nos próprios @Get/@Post/@Patch etc.
 * Com app.setGlobalPrefix('api/v1'), isso também duplicaria o prefixo.
 */
const controllerFiles = walk(
  path.join(API, 'src'),
  (file) => file.endsWith('.controller.ts'),
);

let normalizedDecorators = 0;

for (const file of controllerFiles) {
  const before = fs.readFileSync(file, 'utf8');

  const after = before.replace(
    /@(Controller|Get|Post|Patch|Put|Delete|All|Options|Head)\(\s*(['"])\/?api\/v1(?:\/([^'"]*))?\2\s*\)/g,
    (_full, decorator, quote, tail) => {
      normalizedDecorators += 1;
      const clean = String(tail || '').replace(/^\/+/, '');
      return clean
        ? `@${decorator}(${quote}${clean}${quote})`
        : `@${decorator}()`;
    },
  );

  writeIfChanged(
    file,
    before,
    after,
    'rota normalizada',
  );
}

/**
 * 2) HTTP E2E precisa reproduzir o prefixo do bootstrap real.
 *
 * createNestApplication() não executa main.ts. Portanto os testes HTTP que
 * chamam /api/v1/... devem configurar explicitamente o prefixo global.
 */
const testRoot = path.join(API, 'test');
const e2eFiles = walk(
  testRoot,
  (file) =>
    file.endsWith('.e2e-spec.ts') &&
    !file.includes(`${path.sep}integration${path.sep}`),
);

let patchedBootstraps = 0;

for (const file of e2eFiles) {
  let before = fs.readFileSync(file, 'utf8');

  const callsApiV1 =
    /(?:\.get|\.post|\.put|\.patch|\.delete)\(\s*['"]\/api\/v1(?:\/|['"])/.test(
      before,
    );

  if (
    !callsApiV1 ||
    before.includes('setGlobalPrefix(') ||
    !before.includes('createNestApplication()')
  ) {
    continue;
  }

  const after = before.replace(
    /(^\s*app\s*=\s*[^;\n]*createNestApplication\(\);\s*$)/m,
    `$1\n    app.setGlobalPrefix('api/v1');`,
  );

  if (after === before) {
    throw new Error(
      `Não foi possível inserir o prefixo E2E em ${path.relative(ROOT, file)}.`,
    );
  }

  patchedBootstraps += 1;
  writeIfChanged(
    file,
    before,
    after,
    'bootstrap E2E alinhado',
  );
}

/**
 * 3) Compatibilidade do teste legado Sprint 3 com a evolução do
 * StockReservationsService.
 */
const sprint3Integration = path.join(
  API,
  'test',
  'sprint3-integration.e2e-spec.ts',
);

if (fs.existsSync(sprint3Integration)) {
  let before = fs.readFileSync(sprint3Integration, 'utf8');
  let after = before;

  after = after.replace(
    /orderGroup:\s*\{\s*findUnique:\s*jest\.fn\(\)\.mockResolvedValue\(\{ id: 'group-exp-1', status: 'PENDING_PAYMENT' \}\),\s*update:\s*jest\.fn\(\)\.mockResolvedValue\(\{\}\),\s*\},/m,
    `orderGroup: {
      findUnique: jest.fn().mockResolvedValue({ id: 'group-exp-1', status: 'PENDING_PAYMENT' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },`,
  );

  // couponRedemption já existe no mock antigo, mas faltava updateMany.
  after = after.replace(
    /couponRedemption:\s*\{\s*count:\s*jest\.fn\(\),\s*create:\s*jest\.fn\(\),\s*update:\s*jest\.fn\(\),\s*\},/m,
    `couponRedemption: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },`,
  );

  if (!after.includes('outboxEvent: {')) {
    after = after.replace(
      /(\s*stockReservation:\s*\{[\s\S]*?updateMany:\s*jest\.fn\(\),\s*\},)/m,
      `$1
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-test' }),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({}),
    },`,
    );
  }

  writeIfChanged(
    sprint3Integration,
    before,
    after,
    'mock Sprint 3 atualizado',
  );
}

/**
 * 4) Compatibilidade do teste de concorrência Sprint 4:
 * WalletService passou a depender de WalletTransactionService.
 */
const sprint4Concurrency = path.join(
  API,
  'test',
  'sprint4-concurrency.e2e-spec.ts',
);

if (fs.existsSync(sprint4Concurrency)) {
  const before = fs.readFileSync(sprint4Concurrency, 'utf8');
  let after = before;

  if (
    !after.includes(
      "import { WalletTransactionService } from '../src/modules/wallet/services/wallet-transaction.service';",
    )
  ) {
    after = after.replace(
      "import { WalletService } from '../src/modules/wallet/wallet.service';",
      "import { WalletService } from '../src/modules/wallet/wallet.service';\nimport { WalletTransactionService } from '../src/modules/wallet/services/wallet-transaction.service';",
    );
  }

  if (
    !/providers:\s*\[[\s\S]*?\bWalletTransactionService\b/.test(after)
  ) {
    after = after.replace(
      /(\s+WalletService,\s*\n)/,
      `$1        WalletTransactionService,\n`,
    );
  }

  writeIfChanged(
    sprint4Concurrency,
    before,
    after,
    'teste Sprint 4 atualizado',
  );
}

/**
 * 5) Reforça o contrato automatizado para cobrir Controller E métodos HTTP.
 */
const contractSpec = path.join(
  API,
  'src',
  'api-route-contract.spec.ts',
);

const spec = `import * as fs from 'fs';
import * as path from 'path';

describe('API Route Contract - Sprint 8.1.1', () => {
  const srcRoot = path.resolve(__dirname);
  const apiRoot = path.resolve(__dirname, '..');
  const testRoot = path.join(apiRoot, 'test');

  function walk(dir: string, predicate: (file: string) => boolean): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full, predicate);
      return entry.isFile() && predicate(full) ? [full] : [];
    });
  }

  it('api/v1 pertence somente ao prefixo global, nunca aos decorators REST', () => {
    const offenders = walk(
      srcRoot,
      (file) => file.endsWith('.controller.ts'),
    ).flatMap((file) => {
      const lines = fs.readFileSync(file, 'utf8').split(/\\r?\\n/);
      return lines
        .map((line, index) => ({ line, index: index + 1 }))
        .filter(({ line }) =>
          /@(Controller|Get|Post|Patch|Put|Delete|All|Options|Head)\\(\\s*['"]\\/?api\\/v1(?:\\/|['"])/.test(
            line,
          ),
        )
        .map(({ line, index }) => ({
          file: path.relative(srcRoot, file),
          line: index,
          decorator: line.trim(),
        }));
    });

    expect(offenders).toEqual([]);
  });

  it('main.ts mantém api/v1 como prefixo global padrão', () => {
    const main = fs.readFileSync(
      path.join(srcRoot, 'main.ts'),
      'utf8',
    );

    expect(main).toContain(
      "configService.get<string>('apiPrefix', 'api/v1')",
    );
    expect(main).toContain('app.setGlobalPrefix(apiPrefix)');
  });

  it('HTTP E2E que chama /api/v1 reproduz o prefixo global do bootstrap', () => {
    const offenders = walk(
      testRoot,
      (file) =>
        file.endsWith('.e2e-spec.ts') &&
        !file.includes(
          \`\${path.sep}integration\${path.sep}\`,
        ),
    )
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8');
        const callsApiV1 =
          /(?:\\.get|\\.post|\\.put|\\.patch|\\.delete)\\(\\s*['"]\\/api\\/v1(?:\\/|['"])/.test(
            text,
          );

        return (
          callsApiV1 &&
          text.includes('createNestApplication()') &&
          !text.includes('setGlobalPrefix(')
        );
      })
      .map((file) => path.relative(apiRoot, file));

    expect(offenders).toEqual([]);
  });
});
`;

fs.writeFileSync(contractSpec, spec, 'utf8');
console.log(
  '[Sprint 8.1.1] contrato de rotas ampliado: apps/api/src/api-route-contract.spec.ts',
);

console.log('');
console.log(
  `[Sprint 8.1.1] decorators api/v1 normalizados nesta execução: ${normalizedDecorators}`,
);
console.log(
  `[Sprint 8.1.1] bootstraps HTTP E2E alinhados nesta execução: ${patchedBootstraps}`,
);
console.log('[Sprint 8.1.1] Nenhuma migration necessária.');
console.log(
  '[Sprint 8.1.1] Execute lint, testes direcionados, build, test:e2e e test:integration.',
);
