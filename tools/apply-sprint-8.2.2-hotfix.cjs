const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'apps/api/src/modules/products/products.service.ts');
if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);

let s = fs.readFileSync(file, 'utf8');

const oldCode = "images: (product.images || []).map((image: any) => ({ ...image, url: image.fileKey ? this.minioService.getPublicUrl(image.fileKey) : null })),";
const newCode = "images: (product.images || []).map((image: any) => ({ ...image, url: image.fileKey && typeof (this.minioService as any)?.getPublicUrl === 'function' ? this.minioService.getPublicUrl(image.fileKey) : (image.url || null) })),";

if (s.includes(newCode)) {
  console.log('OK hotfix 8.2.2 já aplicado; nenhuma alteração necessária.');
  process.exit(0);
}
if (!s.includes(oldCode)) {
  throw new Error('Trecho esperado da Sprint 8.2.2 não encontrado. Não alterei o arquivo.');
}

s = s.replace(oldCode, newCode);
fs.writeFileSync(file, s);
console.log('OK apps/api/src/modules/products/products.service.ts');
console.log('Hotfix Sprint 8.2.2 aplicado. Execute novamente build:api e test:e2e.');
