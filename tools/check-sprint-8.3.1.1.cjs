const fs = require('fs');
const s = fs.readFileSync('src/services/sellerService.ts', 'utf8');
let failed = false;
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}
console.log('=== Sprint 8.3.1.1 — SellerService Real API Hotfix ===');
ok('fakeApi removida do SellerService', !s.includes('fakeApi'));
ok('USE_FAKE_API removido do SellerService', !s.includes('USE_FAKE_API'));
ok('Perfil usa SellerApi.getMyProfile', s.includes('SellerApi.getMyProfile()'));
ok('Produtos usam ProductsApi.listMine', s.includes('ProductsApi.listMine'));
ok('Pedidos usam OrdersApi.listSeller', s.includes('OrdersApi.listSeller()'));
ok('SellerApi.list legado removido', !s.includes('SellerApi.list()'));
ok('SellerApi.search legado removido', !s.includes('SellerApi.search('));
ok('SellerApi.pagination legado removido', !s.includes('SellerApi.pagination('));
ok('SellerApi.filters legado removido', !s.includes('SellerApi.filters('));
ok('SellerApi.update legado removido', !s.includes('SellerApi.update('));
ok('Financeiro fake não retorna sucesso', s.includes('Financeiro Seller ainda não possui contrato real'));
ok('Atualização de loja exige id real', s.includes('storeId real é obrigatório'));
ok('Atualização usa StoresApi.updateMine', s.includes('StoresApi.updateMine(id, payload)'));
if (failed) process.exit(1);
console.log('Contrato Sprint 8.3.1.1: PASS');
