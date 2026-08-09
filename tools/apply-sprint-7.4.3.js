const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(
  root,
  'apps/api/src/modules/refunds/services/refund-provider-execution.service.ts',
);

let text = fs.readFileSync(file, 'utf8');

const marker = '  async reconcile(refundId: string) {\n    return this.retry(refundId);\n  }\n\n';

if (!text.includes(marker)) {
  throw new Error(
    'Não encontrei o ponto esperado em refund-provider-execution.service.ts. ' +
      'Confirme que a Sprint 7.4.2 está aplicada.',
  );
}

if (text.includes('async applyProviderWebhookResult(')) {
  console.log('applyProviderWebhookResult já existe; nenhuma alteração necessária.');
  process.exit(0);
}

const method = fs.readFileSync(
  path.join(
    root,
    'apps/api/src/modules/refunds/PATCH-refund-provider-execution.service.txt',
  ),
  'utf8',
);

text = text.replace(marker, marker + method);
fs.writeFileSync(file, text);
console.log('Sprint 7.4.3 aplicada ao RefundProviderExecutionService.');
