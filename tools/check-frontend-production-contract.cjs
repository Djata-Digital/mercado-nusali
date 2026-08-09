const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const errors = [];
const warnings = [];

const apiConfig = read('src/config/api.ts');
const app = read('src/App.tsx');
const main = read('src/main.tsx');
const envExample = read('.env.example');

if (apiConfig.includes('process.env.VITE_')) {
  errors.push(
    'src/config/api.ts ainda usa process.env.VITE_*; Vite deve usar import.meta.env.',
  );
}

if (!apiConfig.includes("env.VITE_USE_FAKE_API === 'true'")) {
  errors.push(
    'Fake API não exige opt-in explícito VITE_USE_FAKE_API=true.',
  );
}

if (!apiConfig.includes('!isProduction && fakeRequested')) {
  errors.push(
    'Fake API não está tecnicamente bloqueada em produção.',
  );
}

if (!main.includes('assertFrontendRuntime()')) {
  errors.push(
    'Bootstrap do frontend não executa assertFrontendRuntime().',
  );
}

for (const marker of [
  'FRONTEND_FEATURES.SELLER_PORTAL',
  'FRONTEND_FEATURES.ADMIN_PORTAL',
  'FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES',
]) {
  if (!app.includes(marker)) {
    errors.push(`App.tsx não aplica o gate ${marker}.`);
  }
}

if (!envExample.includes('VITE_USE_FAKE_API=false')) {
  errors.push(
    '.env.example não documenta VITE_USE_FAKE_API=false.',
  );
}

// Inventário informativo: mocks ainda presentes no source.
// Não falha nesta Sprint porque as áreas que usam mocks diretos ficam gateadas
// em produção e serão convertidas nas próximas sub-sprints 8.2.x.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

const mockImports = walk(path.join(ROOT, 'src'))
  .flatMap((file) => {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    return lines
      .map((line, i) => ({ line, i: i + 1 }))
      .filter(({ line }) =>
        /from ['"].*(?:\/data\/mock|\/api\/fakeApi)/.test(line),
      )
      .map(({ line, i }) => ({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: i,
        import: line.trim(),
      }));
  });

if (mockImports.length > 0) {
  warnings.push(
    `${mockImports.length} imports de mock/fake ainda existem e devem ser removidos nas próximas etapas 8.2.x.`,
  );
}

console.log('=== Mercado Nusali Frontend Production Contract ===');
console.log(`API config: ${errors.length === 0 ? 'OK' : 'FAIL'}`);
console.log(`Mock imports inventariados: ${mockImports.length}`);

if (mockImports.length) {
  console.log('\nPrimeiros imports pendentes:');
  for (const item of mockImports.slice(0, 20)) {
    console.log(`- ${item.file}:${item.line} ${item.import}`);
  }
}

if (warnings.length) {
  console.log('\nWARNINGS:');
  warnings.forEach((w) => console.log(`- ${w}`));
}

if (errors.length) {
  console.error('\nERROS:');
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

console.log('\nContrato de produção do frontend: PASS');
