const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const APPS = path.join(ROOT, 'apps');
const API = path.join(APPS, 'api');

function exists(p) {
  return fs.existsSync(p);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyTree(src, dst) {
  if (!exists(src)) return { copied: 0 };
  let copied = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      ensureDir(to);
      copied += copyTree(from, to).copied;
    } else if (entry.isFile()) {
      ensureDir(path.dirname(to));
      if (!exists(to) || sha256(from) !== sha256(to)) {
        fs.copyFileSync(from, to);
        copied += 1;
        console.log('[NORMALIZE] synced:', path.relative(ROOT, to));
      }
    }
  }

  return { copied };
}

function listFiles(dir, base = dir) {
  if (!exists(dir)) return [];
  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full, base));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }

  return out.sort();
}

function verifyTreeContained(src, dst) {
  const files = listFiles(src);
  const mismatches = [];

  for (const rel of files) {
    const a = path.join(src, rel);
    const b = path.join(dst, rel);

    if (!exists(b)) {
      mismatches.push(`${rel}: missing in target`);
      continue;
    }

    if (sha256(a) !== sha256(b)) {
      mismatches.push(`${rel}: content differs`);
    }
  }

  return mismatches;
}

function safeRemoveTree(src, dst) {
  if (!exists(src)) return;

  const problems = verifyTreeContained(src, dst);
  if (problems.length) {
    throw new Error(
      `Recusando remover ${path.relative(ROOT, src)} porque o destino não contém cópia idêntica:\n` +
      problems.slice(0, 20).join('\n'),
    );
  }

  fs.rmSync(src, { recursive: true, force: true });
  console.log('[NORMALIZE] removed duplicate tree:', path.relative(ROOT, src));
}

if (!exists(API)) {
  throw new Error('apps/api não encontrado. Execute este script na raiz do mercado-nusali.');
}

const duplicateSrc = path.join(APPS, 'src');
const duplicateTest = path.join(APPS, 'test');
const duplicatePrisma = path.join(APPS, 'prisma');

if (!exists(duplicateSrc)) {
  console.log('[NORMALIZE] apps/src não existe. Projeto talvez já esteja normalizado.');
} else {
  console.log('[NORMALIZE] Sincronizando a árvore mais recente apps/src -> apps/api/src...');
  copyTree(duplicateSrc, path.join(API, 'src'));
}

if (exists(duplicateTest)) {
  console.log('[NORMALIZE] Sincronizando apps/test -> apps/api/test...');
  copyTree(duplicateTest, path.join(API, 'test'));
}

if (exists(duplicatePrisma)) {
  console.log('[NORMALIZE] Verificando/sincronizando apps/prisma -> apps/api/prisma...');
  copyTree(duplicatePrisma, path.join(API, 'prisma'));
}

// Arquivos que apareceram indevidamente em apps/ como cópia de apps/api/.
// Só removemos quando o conteúdo for exatamente igual ao correspondente.
const duplicateRootFiles = [
  '.env',
  '.env.example',
  '.env.test',
  '.env.test.example',
  'Dockerfile',
  'eslint.config.mjs',
  'nest-cli.json',
  'package.json',
  'tsconfig.build.json',
  'tsconfig.json',
];

for (const name of duplicateRootFiles) {
  const stray = path.join(APPS, name);
  const canonical = path.join(API, name);

  if (!exists(stray)) continue;

  if (!exists(canonical)) {
    throw new Error(
      `Recusando remover apps/${name}: apps/api/${name} não existe.`,
    );
  }

  if (sha256(stray) !== sha256(canonical)) {
    throw new Error(
      `Recusando remover apps/${name}: conteúdo difere de apps/api/${name}.`,
    );
  }

  fs.rmSync(stray, { force: true });
  console.log('[NORMALIZE] removed duplicate file:', `apps/${name}`);
}

// Agora que o alvo canônico contém tudo de forma idêntica, removemos as árvores duplicadas.
safeRemoveTree(duplicateSrc, path.join(API, 'src'));
safeRemoveTree(duplicateTest, path.join(API, 'test'));
safeRemoveTree(duplicatePrisma, path.join(API, 'prisma'));

// Validações específicas das Sprints recentes.
const required = [
  'apps/api/src/modules/settlements/settlement-batch-operations.service.ts',
  'apps/api/src/modules/settlements/settlement-recovery-audit.service.ts',
  'apps/api/src/modules/settlements/settlement-readiness.service.ts',
  'apps/api/src/modules/settlements/settlement-metrics.service.ts',
  'apps/api/src/modules/settlements/settlement-operational-monitor.service.ts',
  'apps/api/src/modules/settlements/dto/settlement-admin-operations.dto.ts',
];

const missing = required.filter((rel) => !exists(path.join(ROOT, rel)));
if (missing.length) {
  throw new Error(
    'Normalização incompleta. Arquivos recentes ausentes:\n' + missing.join('\n'),
  );
}

// Confirma que não sobraram as árvores paralelas.
const leftovers = [
  'apps/src',
  'apps/test',
  'apps/prisma',
].filter((rel) => exists(path.join(ROOT, rel)));

if (leftovers.length) {
  throw new Error(
    'Ainda existem árvores duplicadas após a normalização: ' + leftovers.join(', '),
  );
}

console.log('');
console.log('[NORMALIZE] Projeto normalizado com sucesso.');
console.log('[NORMALIZE] Fonte canônica da API: apps/api');
console.log('[NORMALIZE] Sprints 7.6.5, 7.6.6 e 7.6.7 preservadas em apps/api.');
console.log('[NORMALIZE] Nenhuma migration foi criada ou alterada.');
console.log('[NORMALIZE] Agora execute os comandos de validação do README.');
