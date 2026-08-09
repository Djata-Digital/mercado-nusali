const fs = require('fs');

function read(p) { return fs.readFileSync(p, 'utf8'); }

let failed = false;
function ok(name, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${name}`);
  if (!cond) failed = true;
}

const cartView = read('src/components/CartView.tsx');
const cartCtx = read('src/context/CartContext.tsx');
const oldModule = read('apps/api/src/modules/cart/cart.module.ts');
const adapter = read('src/api/adapters/publicCatalog.ts');

ok('CartProvider real existe', cartCtx.includes('CartApi.get()') && cartCtx.includes('CartApi.addItem'));
ok('Guest cart sincroniza no login', cartCtx.includes('CartApi.merge'));
ok('Produto expõe variantId real', adapter.includes('variantId: active?.id'));
ok('Cupom fictício NUSALI10 removido do carrinho', !cartView.includes('NUSALI10'));
ok('Frete fixo 29.90 removido do carrinho', !cartView.includes('29.90'));
ok('Localização fixa Bissau/1000 removida do carrinho', !cartView.includes("zipCode: '1000'"));

const importRegistered = /import\s*\{\s*CartController\s*\}\s*from\s*['"]\.\/cart\.controller['"]\s*;?/m.test(oldModule);
const controllerRegistered = /controllers\s*:\s*\[\s*CartController\s*\]/m.test(oldModule);

ok('Controller /cart legado não é registrado', !importRegistered && !controllerRegistered);

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.3: PASS');
