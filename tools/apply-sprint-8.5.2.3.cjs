const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function patch(rel, replacements) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');

  for (const [before, after, label] of replacements) {
    if (s.includes(after)) {
      console.log('OK', rel, '-', label, '(já aplicado)');
      continue;
    }
    if (!s.includes(before)) {
      throw new Error(`Trecho esperado não encontrado em ${rel}: ${label}`);
    }
    s = s.replace(before, after);
    console.log('OK', rel, '-', label);
  }

  fs.writeFileSync(file, s, 'utf8');
}

console.log('=== Sprint 8.5.2.3 — Sanitizer Type Hotfix ===');

patch('apps/api/src/modules/fulfillment/services/shipping.service.ts', [
  [
    `  private sanitizeShipmentResponse<T extends any>(shipment: T): T {`,
    `  private sanitizeShipmentResponse(shipment: any): any {`,
    'sanitizer de shipment sem generic estreito'
  ],
]);

patch('apps/api/src/modules/fulfillment/services/manifest.service.ts', [
  [
    `  private sanitizeManifestResponse<T extends any>(manifest: T): T {`,
    `  private sanitizeManifestResponse(manifest: any): any {`,
    'sanitizer de manifest sem generic estreito'
  ],
]);

console.log('Hotfix Sprint 8.5.2.3 aplicado.');
