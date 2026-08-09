const fs = require('fs');

const s = fs.readFileSync('src/services/storeService.ts', 'utf8');

let failed = false;
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

console.log('=== Sprint 8.2.7.1 — StoreService Real API Hotfix ===');

ok('StoreService usa listPublic', s.includes('StoresApi.listPublic()'));
ok('StoreService usa getPublicBySlug', s.includes('StoresApi.getPublicBySlug(slug)'));
ok('StoresApi.list legado removido', !s.includes('StoresApi.list()'));
ok('StoresApi.getById legado removido', !s.includes('StoresApi.getById('));
ok('Fallback USE_FAKE_API removido', !s.includes('USE_FAKE_API'));
ok('Loja fake Moda Afro removida', !s.includes('Moda Afro CPLP Bissau'));
ok('Unsplash fake removido', !s.includes('images.unsplash.com'));
ok('Adapter mantém compatibilidade com Store legado', s.includes('mapPublicStoreToLegacyStore'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.7.1: PASS');
