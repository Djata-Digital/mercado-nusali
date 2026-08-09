const fs = require('fs');
let failed = false;
const read = (p) => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const hub = read('src/components/SellerHubView.tsx');
const sellerApi = read('src/api/clients/SellerApi.ts');
const storesApi = read('src/api/clients/StoresApi.ts');
const productsApi = read('src/api/clients/ProductsApi.ts');
const ordersApi = read('src/api/clients/OrdersApi.ts');

console.log('=== Sprint 8.3.1 — Seller Core Real ===');
ok('SellerHub não importa mockSellerData', !hub.includes('mockSellerData'));
ok('SellerHub não usa initialSellerProfile', !hub.includes('initialSellerProfile'));
ok('Seller profile usa /sellers/me', sellerApi.includes("'/sellers/me'"));
ok('Seller stores usa /stores/me', storesApi.includes("'/stores/me'"));
ok('Seller products usa /products/me', productsApi.includes("'/products/me'"));
ok('Seller orders usa /orders/seller', ordersApi.includes("'/orders/seller'"));
ok('Ações reais de produto existem', productsApi.includes("'/submit'") && productsApi.includes("'/pause'") && productsApi.includes("'/activate'"));
ok('SellerHub não exibe receita fictícia 14850000', !hub.includes('14850000'));
ok('SellerHub não exibe saldo fictício 6850000', !hub.includes('6850000'));
ok('SellerHub não exibe unreadMessagesCount fake', !hub.includes('unreadMessagesCount'));
ok('SellerHub não exibe openDisputesCount fake', !hub.includes('openDisputesCount'));
ok('SellerHub avisa módulos ainda não reais', hub.includes('permanecem fora deste portal core'));
ok('SellerHub consulta APIs reais via React Query', hub.includes("queryKey: ['seller-profile-real']") && hub.includes("queryKey: ['seller-products-real']"));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.3.1: PASS');
