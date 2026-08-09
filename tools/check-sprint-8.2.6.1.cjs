const fs = require('fs');
let failed = false;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(label, cond) {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}
const disputes = read('src/components/DisputesEscrowView.tsx');
const returns = read('src/components/ReturnsRefundsView.tsx');

console.log('=== Sprint 8.2.6.1 — BuyerOrder compatibility hotfix ===');
ok('Disputes usa productTitleSnapshot real', disputes.includes('productTitleSnapshot'));
ok('Disputes não acessa o.items[0]?.product.title', !disputes.includes("o.items[0]?.product.title"));
ok('Disputes converte total Decimal/string para number', disputes.includes('formatCurrency(Number(o.total)'));
ok('Disputes usa currency.code real', disputes.includes("o.currency?.code || selectedCurrency"));
ok('Returns remove fallback NSL-8941203 do selectedOrderId', !returns.includes("useState(orders[0]?.id || 'NSL-8941203')"));
ok('Returns converte total Decimal/string para number', returns.includes('formatCurrency(Number(o.total)'));
ok('Returns não acessa o.date', !returns.includes('({o.date})'));
ok('Returns usa placedAt/createdAt real', returns.includes('o.placedAt || o.createdAt'));
ok('Returns usa orderNumber real no seletor', returns.includes('Pedido #{o.orderNumber}'));

if (failed) process.exit(1);
console.log('Contrato Sprint 8.2.6.1: PASS');
