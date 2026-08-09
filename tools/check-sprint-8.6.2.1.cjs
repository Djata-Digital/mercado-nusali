const fs = require('fs');

let failed = false;
const s = fs.readFileSync('apps/api/test/app.e2e-spec.ts', 'utf8');

function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

console.log('=== Sprint 8.6.2.1 — Health E2E Storage Hotfix ===');

ok('E2E importa StorageService', s.includes("import { StorageService } from '../src/modules/storage/storage.service';"));
ok('E2E mocka checkHealth=true', s.includes('checkHealth: jest.fn().mockResolvedValue(true)'));
ok('TestingModule sobrescreve StorageService', s.includes('.overrideProvider(StorageService)'));
ok('Health espera objectStorage up', s.includes("objectStorage: 'up'"));
ok('Readiness confirma chamada de storage health', s.includes('expect(mockStorageService.checkHealth).toHaveBeenCalled()'));
ok('Descrição menciona Object Storage', s.includes('PostgreSQL, Redis & Object Storage Check'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.6.2.1: PASS');
