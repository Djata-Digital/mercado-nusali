const fs = require('fs');
const path = require('path');

const rel = 'apps/api/src/modules/cart/cart.module.ts';
const file = path.join(process.cwd(), rel);

if (!fs.existsSync(file)) {
  throw new Error(`Arquivo não encontrado: ${rel}`);
}

let s = fs.readFileSync(file, 'utf8');

const importLine = "import { CartController } from './cart.controller';";
const controllersRegex = /^\s*controllers\s*:\s*\[\s*CartController\s*\]\s*,?\s*$/m;

let changed = false;

if (s.includes(importLine)) {
  s = s.replace(importLine + '\r\n', '').replace(importLine + '\n', '').replace(importLine, '');
  changed = true;
  console.log('OK import CartController legado removido');
} else {
  console.log('OK import CartController legado já ausente');
}

if (controllersRegex.test(s)) {
  s = s.replace(controllersRegex, '');
  changed = true;
  console.log('OK registro controllers: [CartController] removido');
} else {
  console.log('OK registro controllers: [CartController] já ausente');
}

if (changed) {
  fs.writeFileSync(file, s, 'utf8');
  console.log(`OK ${rel} atualizado`);
} else {
  console.log(`OK ${rel} já estava corrigido`);
}

console.log('Hotfix CartController 8.2.3 aplicado.');
