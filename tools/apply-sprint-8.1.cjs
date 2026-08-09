const fs = require('fs');
const path = require('path');

const root = process.cwd();
const api = path.join(root, 'apps', 'api');
if (!fs.existsSync(api)) throw new Error('Execute este script na raiz de mercado-nusali.');

const replacements = {
  'src/modules/payments/payments.controller.ts': ["@Controller('api/v1/payments')", "@Controller('payments')"],
  'src/modules/coupons/coupons.controller.ts': ["@Controller('api/v1')", "@Controller()"],
  'src/modules/escrow/escrow.controller.ts': ["@Controller('api/v1/escrow')", "@Controller('escrow')"],
  'src/modules/addresses/addresses.controller.ts': ["@Controller('api/v1/addresses')", "@Controller('addresses')"],
  'src/modules/webhooks/webhooks.controller.ts': ["@Controller('api/v1/webhooks')", "@Controller('webhooks')"],
  'src/modules/payouts/payouts.controller.ts': ["@Controller('api/v1/payouts')", "@Controller('payouts')"],
  'src/modules/refunds/refunds.controller.ts': ["@Controller('api/v1/refunds')", "@Controller('refunds')"],
  'src/modules/refunds/refund-provider-webhook.controller.ts': ["@Controller('api/v1/refunds/provider-webhooks')", "@Controller('refunds/provider-webhooks')"],
  'src/modules/carts/carts.controller.ts': ["@Controller('api/v1/cart')", "@Controller('cart')"],
  'src/modules/wallet/wallet.controller.ts': ["@Controller('api/v1/wallet')", "@Controller('wallet')"],
  'src/modules/shipping-quotes/shipping-quotes.controller.ts': ["@Controller('api/v1/checkout')", "@Controller('checkout')"],
};

for (const [rel, [from, to]] of Object.entries(replacements)) {
  const file = path.join(api, rel);
  if (!fs.existsSync(file)) throw new Error(`Arquivo esperado não encontrado: apps/api/${rel}`);
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes(from)) {
    text = text.replace(from, to);
    fs.writeFileSync(file, text, 'utf8');
    console.log(`[Sprint 8.1] corrigido apps/api/${rel}`);
  } else if (text.includes(to)) {
    console.log(`[Sprint 8.1] já normalizado apps/api/${rel}`);
  } else {
    throw new Error(`Contrato inesperado em apps/api/${rel}; nenhuma alteração automática aplicada.`);
  }
}

const spec = `import * as fs from 'fs';
import * as path from 'path';

describe('API Route Contract - Sprint 8.1', () => {
  const srcRoot = path.resolve(__dirname);

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && entry.name.endsWith('.controller.ts') ? [full] : [];
    });
  }

  it('nenhum controller repete o prefixo global api/v1', () => {
    const offenders = walk(srcRoot).filter((file) =>
      /@Controller\\(\\s*['\"]\\/?api\\/v1(?:\\/|['\"])/.test(fs.readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => path.relative(srcRoot, file))).toEqual([]);
  });

  it('main.ts mantém api/v1 como prefixo global padrão', () => {
    const main = fs.readFileSync(path.join(srcRoot, 'main.ts'), 'utf8');
    expect(main).toContain("configService.get<string>('apiPrefix', 'api/v1')");
    expect(main).toContain('app.setGlobalPrefix(apiPrefix)');
  });
});
`;
const specPath = path.join(api, 'src', 'api-route-contract.spec.ts');
fs.writeFileSync(specPath, spec, 'utf8');
console.log('[Sprint 8.1] criado apps/api/src/api-route-contract.spec.ts');
console.log('[Sprint 8.1] Nenhuma migration necessária.');
console.log('[Sprint 8.1] Prefixo api/v1 agora pertence exclusivamente ao bootstrap global.');
