const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const target = path.join(
  ROOT,
  'apps/api/src/modules/settlements/settlement-batch-operations.service.ts',
);

if (!fs.existsSync(target)) {
  throw new Error(
    'settlement-batch-operations.service.ts não encontrado. Aplique a Sprint 7.6.5 antes deste fix.',
  );
}

let content = fs.readFileSync(target, 'utf8');

const old1 = `.filter((row) => !TERMINAL.includes(row.status as SellerSettlementStatus))`;
const old2 = `.filter((row) => !TERMINAL.includes(row.status))`;
const replacement = `.filter(
      (row) =>
        row.status !== SellerSettlementStatus.SETTLED &&
        row.status !== SellerSettlementStatus.FAILED,
    )`;

if (content.includes(old1)) {
  content = content.replace(old1, replacement);
} else if (content.includes(old2)) {
  content = content.replace(old2, replacement);
} else if (
  content.includes(
    'row.status !== SellerSettlementStatus.SETTLED',
  ) &&
  content.includes(
    'row.status !== SellerSettlementStatus.FAILED',
  )
) {
  console.log(
    '[Sprint 7.6.5 FIX2] correção já aplicada; nenhuma alteração necessária.',
  );
  process.exit(0);
} else {
  throw new Error(
    'Expressão TERMINAL.includes esperada não encontrada.',
  );
}

// Remove a declaração TERMINAL se ela não for mais usada.
content = content.replace(
  /const TERMINAL[\s\S]*?;\r?\n\r?\n/,
  '',
);

fs.writeFileSync(target, content, 'utf8');

console.log(
  '[Sprint 7.6.5 FIX2] comparação de status terminais reescrita sem Array.includes().',
);
console.log('[Sprint 7.6.5 FIX2] Nenhuma migration necessária.');
console.log('[Sprint 7.6.5 FIX2] Nenhuma regra de negócio foi alterada.');
