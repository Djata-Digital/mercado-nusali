const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const target = path.join(
  ROOT,
  'apps/api/test/integration/financial-reconciliation-recovery-audit-real-postgres.integration.e2e-spec.ts',
);

if (!fs.existsSync(target)) {
  throw new Error(
    'Arquivo da Sprint 7.5.7 não encontrado. Aplique a Sprint 7.5.7 antes deste fix.',
  );
}

let content = fs.readFileSync(target, 'utf8');

const oldText = `severity: 'ERROR',`;
const newText = `severity: 'CRITICAL',`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync(target, content, 'utf8');
  console.log('[Sprint 7.5.7 FIX] severity ERROR -> CRITICAL corrigida.');
} else if (content.includes(newText)) {
  console.log('[Sprint 7.5.7 FIX] correção já aplicada; nenhuma alteração necessária.');
} else {
  throw new Error(
    'Não foi possível localizar o campo severity esperado no teste da Sprint 7.5.7.',
  );
}

console.log('[Sprint 7.5.7 FIX] Nenhuma migration necessária.');
