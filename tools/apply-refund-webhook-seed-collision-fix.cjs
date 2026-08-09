const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const target = path.join(
  ROOT,
  'apps/api/test/integration/refund-webhook-reconciliation-real-postgres.integration.e2e-spec.ts',
);

if (!fs.existsSync(target)) {
  throw new Error(
    'refund-webhook-reconciliation-real-postgres.integration.e2e-spec.ts não encontrado.',
  );
}

let content = fs.readFileSync(target, 'utf8');

const oldSeed = `const short = seed.replace(/-/g, '').slice(0, 10);`;
const newSeed = `const short = seed.replace(/-/g, '').slice(0, 20);`;

const oldCurrency = 'code: `R${short.slice(0, 5)}`,';
const newCurrency = 'code: `R${short.slice(0, 16)}`,';

const oldCountry = 'code: `RC${short.slice(0, 5)}`,';
const newCountry = 'code: `RC${short.slice(0, 16)}`,';

let changed = false;

if (content.includes(oldSeed)) {
  content = content.replace(oldSeed, newSeed);
  changed = true;
}

if (content.includes(oldCurrency)) {
  content = content.replace(oldCurrency, newCurrency);
  changed = true;
}

if (content.includes(oldCountry)) {
  content = content.replace(oldCountry, newCountry);
  changed = true;
}

if (!changed) {
  if (
    content.includes(newSeed) &&
    content.includes(newCurrency) &&
    content.includes(newCountry)
  ) {
    console.log(
      '[Integration Seed FIX] correção já aplicada; nenhuma alteração necessária.',
    );
    process.exit(0);
  }

  throw new Error(
    'Não foi possível localizar o seed antigo esperado no teste de Refund.',
  );
}

fs.writeFileSync(target, content, 'utf8');

console.log(
  '[Integration Seed FIX] identificadores únicos de Currency/Country ampliados.',
);
console.log(
  '[Integration Seed FIX] Nenhum código de produção foi alterado.',
);
console.log(
  '[Integration Seed FIX] Nenhuma migration necessária.',
);
