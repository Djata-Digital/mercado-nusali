const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const targets = [
  'apps/api/src/modules/fulfillment',
  'apps/api/src/modules/logistics',
  'apps/api/src/modules/orders',
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(controller|dto|service)\.ts$/i.test(entry.name)) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function extractController(text) {
  const controller = [...text.matchAll(/@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
  const routes = [];
  const re = /@(Get|Post|Patch|Put|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    const after = text.slice(m.index, m.index + 900);
    const method = after.match(/(?:async\s+)?([A-Za-z0-9_]+)\s*\(/);
    routes.push({
      verb: m[1].toUpperCase(),
      route: m[2] || '',
      method: method?.[1] || '?',
    });
  }
  const roles = [...text.matchAll(/@Roles\(([^)]*)\)/g)].map(m => m[1].trim());
  const perms = [...text.matchAll(/@Permissions?\(([^)]*)\)/g)].map(m => m[1].trim());
  const dtoImports = [...text.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"][^'"]*dto[^'"]*['"]/g)]
    .flatMap(m => m[1].split(',').map(x => x.trim()).filter(Boolean));
  return { controller, routes, roles, perms, dtoImports };
}

function extractDtos(text) {
  const classes = [...text.matchAll(/export\s+class\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);
  const enums = [...text.matchAll(/export\s+enum\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);
  const fields = [...text.matchAll(/^\s*([A-Za-z0-9_]+)[?!]?\s*:\s*([^;=]+);/gm)]
    .map(m => `${m[1]}: ${m[2].trim()}`);
  return { classes, enums, fields };
}

const files = [...new Set(targets.flatMap(t => walk(path.join(ROOT, t))))].sort();

console.log('=== Mercado Nusali — Preflight 8.5.0 Fulfillment/Logistics ===');
console.log(`Arquivos analisados: ${files.length}`);

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.controller\.ts$/i.test(file)) {
    const info = extractController(text);
    console.log('\nCONTROLLER', rel(file));
    console.log('  base:', info.controller.join(', ') || '(não detectado)');
    for (const r of info.routes) {
      console.log(`  ${r.verb.padEnd(6)} ${r.route || '/'} -> ${r.method}`);
    }
    if (info.roles.length) console.log('  roles:', info.roles.join(' | '));
    if (info.perms.length) console.log('  permissions:', info.perms.join(' | '));
    if (info.dtoImports.length) console.log('  DTO imports:', [...new Set(info.dtoImports)].join(', '));
  }

  if (/\.dto\.ts$/i.test(file)) {
    const info = extractDtos(text);
    if (info.classes.length || info.enums.length) {
      console.log('\nDTO', rel(file));
      if (info.classes.length) console.log('  classes:', info.classes.join(', '));
      if (info.enums.length) console.log('  enums:', info.enums.join(', '));
      for (const field of info.fields.slice(0, 40)) console.log('  field:', field);
    }
  }
}

const frontendCandidates = [
  'src/components/admin/AdminLogisticsDashboard.tsx',
  'src/components/SellerHubView.tsx',
  'src/App.tsx',
  'src/api/fakeApi/index.ts',
];

console.log('\n=== FRONTEND LOGISTICS STATUS ===');
for (const relPath of frontendCandidates) {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  console.log(relPath);
  console.log('  mock/fake:', /\bmock|fakeApi|USE_FAKE_API/i.test(text) ? 'SIM' : 'NÃO');
  const apiRefs = [...text.matchAll(/['"`](\/[^'"`]*(?:logistics|picking|packing|shipment|manifest|tracking)[^'"`]*)['"`]/gi)]
    .map(m => m[1]);
  if (apiRefs.length) console.log('  rotas:', [...new Set(apiRefs)].join(', '));
}

console.log('\n=== PRODUCTION INFRA WARNINGS ===');
const warningFiles = [
  'apps/api/src/modules/logistics/webhooks/carrier-webhook.service.ts',
  'apps/api/src/modules/redis/redis.service.ts',
];
for (const relPath of warningFiles) {
  const p = path.join(ROOT, relPath);
  console.log(`${relPath}: ${fs.existsSync(p) ? 'EXISTE' : 'AUSENTE'}`);
}

console.log('\nPreflight 8.5.0 concluído. Copie toda esta saída para o ChatGPT.');
