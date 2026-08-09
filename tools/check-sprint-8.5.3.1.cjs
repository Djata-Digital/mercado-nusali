const fs = require('fs');
let failed = false;
const read = p => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const label = read('apps/api/src/modules/fulfillment/services/label.service.ts');
const manifest = read('apps/api/src/modules/fulfillment/services/manifest.service.ts');

console.log('=== Sprint 8.5.3.1 — Carrier Name Narrowing Hotfix ===');

ok('Label normaliza carrierName uma vez', label.includes('const carrierName = dto.carrierName?.trim();'));
ok('Label rejeita carrierName vazio', label.includes("if (!carrierName)"));
ok('Label persiste variável validada', label.includes('carrierName,'));
ok('Label não chama dto.carrierName.trim na persistência', !label.includes('carrierName: dto.carrierName.trim()'));

ok('Manifest normaliza carrierName uma vez', manifest.includes('const carrierName = dto.carrierName?.trim();'));
ok('Manifest rejeita carrierName vazio', manifest.includes("if (!carrierName)"));
ok('Manifest persiste variável validada', manifest.includes('carrierName,'));
ok('Manifest não chama dto.carrierName.trim na persistência', !manifest.includes('carrierName: dto.carrierName.trim()'));

ok('Fallback Mercado Nusali Express continua removido', !label.includes("Mercado Nusali Express"));
ok('Fallback Transportes Nusali continua removido', !manifest.includes("Transportes Nusali"));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.5.3.1: PASS');
