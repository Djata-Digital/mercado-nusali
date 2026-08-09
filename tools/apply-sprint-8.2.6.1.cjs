const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function patch(rel, replacements) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to, label] of replacements) {
    if (s.includes(from)) {
      s = s.replace(from, to);
      console.log('OK', rel, '-', label);
    } else if (s.includes(to)) {
      console.log('OK', rel, '-', label, '(já aplicado)');
    } else {
      console.error('FAIL', rel, '-', label, '(trecho esperado não encontrado)');
      process.exitCode = 1;
      return;
    }
  }
  fs.writeFileSync(file, s, 'utf8');
}

console.log('=== Sprint 8.2.6.1 — BuyerOrder compatibility hotfix ===');

patch('src/components/DisputesEscrowView.tsx', [
  [
    "Pedido #{o.id} - {o.items[0]?.product.title} ({formatCurrency(o.total, o.currency)})",
    "Pedido #{o.orderNumber} - {o.items[0]?.productTitleSnapshot || 'Produto'} ({formatCurrency(Number(o.total), o.currency?.code || selectedCurrency)})",
    'BuyerOrder real no seletor de disputa'
  ],
]);

patch('src/components/ReturnsRefundsView.tsx', [
  [
    "const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || 'NSL-8941203');",
    "const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || '');",
    'fallback de pedido fictício removido'
  ],
  [
    "Pedido #{o.id} - Total: {formatCurrency(o.total, o.currency)} ({o.date})",
    "Pedido #{o.orderNumber} - Total: {formatCurrency(Number(o.total), o.currency?.code || selectedCurrency)} ({new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(o.placedAt || o.createdAt))})",
    'BuyerOrder real no seletor de devolução'
  ],
]);

if (!process.exitCode) {
  console.log('Hotfix Sprint 8.2.6.1 aplicado. Execute checker, lint e validação completa.');
}
