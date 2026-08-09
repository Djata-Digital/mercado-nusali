const fs = require('fs');
let failed = false;
const read = (p) => fs.readFileSync(p, 'utf8');
const ok = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
};

const wizard = read('src/components/seller/SellerProductWizard.tsx');
const hub = read('src/components/SellerHubView.tsx');
const variants = read('src/api/clients/ProductVariantsApi.ts');
const images = read('src/api/clients/ProductImagesApi.ts');
const inventory = read('src/api/clients/InventoryApi.ts');
const warehouses = read('src/api/clients/WarehousesApi.ts');

console.log('=== Sprint 8.3.2 — Seller Product Authoring Real ===');
ok('Wizard não usa mockCategories', !wizard.includes('mockCategories'));
ok('Wizard não usa Unsplash fake', !wizard.includes('images.unsplash.com'));
ok('Wizard não gera falso produto local', !wizard.includes('onAddProduct'));
ok('Wizard usa ProductsApi.create', wizard.includes('ProductsApi.create({'));
ok('Variante usa endpoint real', variants.includes('`/products/${productId}/variants`') && wizard.includes('ProductVariantsApi.create'));
ok('Imagem usa multipart real', images.includes('FormData') && wizard.includes('ProductImagesApi.upload'));
ok('Estoque usa /inventory/adjust', inventory.includes("'/inventory/adjust'") && wizard.includes('InventoryApi.adjust'));
ok('Warehouse Seller usa /warehouses/me', warehouses.includes("'/warehouses/me'"));
ok('Warehouse real pode ser criado', warehouses.includes("'/warehouses'") && wizard.includes('WarehousesApi.create'));
ok('Categorias vêm da API real', wizard.includes('CategoriesApi.listPublic()'));
ok('Brands vêm da API real', wizard.includes('BrandsApi.listPublic()'));
ok('Currencies vêm da API real', wizard.includes('CurrenciesApi.list()'));
ok('Produto físico exige peso', wizard.includes("productType === 'PHYSICAL' && !(weightNumber > 0)"));
ok('Imagem obrigatória antes da submissão', wizard.includes('if (imageError)'));
ok('Estoque mínimo real antes da submissão', wizard.includes('stockNumber < 1'));
ok('Submit real ocorre após estoque', wizard.indexOf('InventoryApi.adjust') < wizard.indexOf('ProductsApi.submit(product.id)'));
ok('Falha preserva DRAFT e não finge sucesso', wizard.includes('foi preservado como rascunho') && wizard.includes('não houve falso sucesso'));
ok('SellerHub expõe cadastro real', hub.includes('setIsAuthoringProduct(true)') && hub.includes('<SellerProductWizard'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.3.2: PASS');
