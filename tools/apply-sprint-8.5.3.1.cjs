const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function replaceRequired(rel, before, after, label) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');

  if (s.includes(after)) {
    console.log('OK', rel, '-', label, '(já aplicado)');
    return;
  }

  if (!s.includes(before)) {
    throw new Error(`Trecho esperado não encontrado em ${rel}: ${label}`);
  }

  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel, '-', label);
}

console.log('=== Sprint 8.5.3.1 — Carrier Name Narrowing Hotfix ===');

replaceRequired(
  'apps/api/src/modules/fulfillment/services/label.service.ts',
  `    const packingOrderId = dto.packingOrderId;
    if (!dto.carrierName || !dto.carrierName.trim()) {
      throw new BadRequestException('Nome real da transportadora (carrierName) é obrigatório.');
    }`,
  `    const packingOrderId = dto.packingOrderId;
    const carrierName = dto.carrierName?.trim();
    if (!carrierName) {
      throw new BadRequestException('Nome real da transportadora (carrierName) é obrigatório.');
    }`,
  'carrierName validado em variável local'
);

replaceRequired(
  'apps/api/src/modules/fulfillment/services/label.service.ts',
  `          carrierName: dto.carrierName.trim(),`,
  `          carrierName,`,
  'persistência usa carrierName validado'
);

replaceRequired(
  'apps/api/src/modules/fulfillment/services/manifest.service.ts',
  `    if (!dto.carrierName || !dto.carrierName.trim()) {
      throw new BadRequestException('Nome real da transportadora (carrierName) é obrigatório no romaneio.');
    }`,
  `    const carrierName = dto.carrierName?.trim();
    if (!carrierName) {
      throw new BadRequestException('Nome real da transportadora (carrierName) é obrigatório no romaneio.');
    }`,
  'carrierName do romaneio validado em variável local'
);

replaceRequired(
  'apps/api/src/modules/fulfillment/services/manifest.service.ts',
  `          carrierName: dto.carrierName.trim(),`,
  `          carrierName,`,
  'manifest persiste carrierName validado'
);

console.log('Hotfix Sprint 8.5.3.1 aplicado.');
