const fs = require('fs');
let failed = false;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

const list = read('src/pages/StoresListPage.tsx');
const view = read('src/components/StorePublicView.tsx');
const storesApi = read('src/api/clients/StoresApi.ts');
const productsService = read('apps/api/src/modules/products/products.service.ts');
const storesService = read('apps/api/src/modules/stores/stores.service.ts');
const app = read('src/App.tsx');

console.log('=== Sprint 8.2.7 — Public Stores Real ===');
ok('Lista usa GET /public/stores', storesApi.includes("'/public/stores'") && list.includes('StoresApi.listPublic'));
ok('Detalhe usa GET /public/stores/:slug', storesApi.includes('getPublicBySlug') && view.includes('StoresApi.getPublicBySlug(slug)'));
ok('Rota pública usa slug real', app.includes('path="/stores/:slug"'));
ok('mockStoresList removido', !list.includes('mockStoresList'));
ok('mockStoreDefault removido', !view.includes('mockStoreDefault'));
ok('Página pública não inventa depoimentos', !view.includes('Mariama D.') && !view.includes('Carlos E.'));
ok('Página pública não inventa 99% satisfação', !view.includes('99% de compradores satisfeitos'));
ok('Página pública não inventa resposta < 1 hora', !view.includes('Responde em menos de 1 hora'));
ok('Seguir loja falso removido', !view.includes('isFollowing') && !view.includes('Seguindo Loja'));
ok('Mensagem para vendedor falsa não é exibida', !view.includes('Falar com Vendedor'));
ok('Catálogo envia storeId ao backend', view.includes('storeId: store!.id'));
ok('Backend filtra public products por storeId', productsService.includes('if (query.storeId) where.storeId = query.storeId'));
ok('Resposta pública da loja é sanitizada', storesService.includes('private mapPublicStore(store: any)'));
const publicDetailStart = storesService.indexOf('async getPublicStoreBySlug');
const publicDetailEnd = storesService.indexOf('// Admin Endpoints', publicDetailStart);
const publicDetail = publicDetailStart >= 0
  ? storesService.slice(publicDetailStart, publicDetailEnd >= 0 ? publicDetailEnd : undefined)
  : '';
ok('Public store não retorna SellerProfile inteiro', publicDetail.length > 0 && !publicDetail.includes('seller: true'));
ok('Seller público limita campos', storesService.includes('tradeName: true') && storesService.includes('totalSales: true'));
ok('URLs MinIO toleram mocks sem getPublicUrl', storesService.includes("typeof (this.minioService as any)?.getPublicUrl === 'function'"));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.7: PASS');
