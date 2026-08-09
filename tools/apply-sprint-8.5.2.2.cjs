const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.5.2.2 — Fulfillment Circular Response + Seller Boundary Hotfix ===');

// 1. SellerHub: remove a função legada inteira. Ela ainda chamava um método já removido.
{
  const rel = 'src/components/SellerHubView.tsx';
  let s = read(rel);
  const rx = /\n\s*const orderStatusAction = async \([\s\S]*?\n\s*\};\n\n(?=\s*const productAction)/m;
  if (s.includes('updateSellerStatus') || s.includes('const orderStatusAction')) {
    const next = s.replace(rx, '\n\n');
    if (next === s) throw new Error('Não foi possível remover orderStatusAction legado de SellerHubView.tsx');
    s = next;
    write(rel, s);
  } else {
    console.log('OK', rel, '(já aplicado)');
  }
}

// 2. ShippingService: resposta HTTP não pode devolver back-reference circular
// shippingLabel.packingOrder -> packingOrder.shippingLabel.
{
  const rel = 'apps/api/src/modules/fulfillment/services/shipping.service.ts';
  let s = read(rel);

  if (!s.includes('private sanitizeShipmentResponse')) {
    const marker = `  constructor(private readonly prisma: PrismaService) {}\n`;
    if (!s.includes(marker)) throw new Error('Constructor de ShippingService não encontrado');

    const helper = `
  /**
   * Prisma real não cria ciclos quando relações são selecionadas em uma única direção,
   * mas mocks/test doubles e futuros adapters podem trazer a back-reference
   * shippingLabel.packingOrder. Nunca devolvemos essa back-reference pela API.
   */
  private sanitizeShipmentResponse<T extends any>(shipment: T): T {
    if (!shipment || typeof shipment !== 'object') return shipment;

    const packingOrder = shipment.packingOrder;
    const shippingLabel = packingOrder?.shippingLabel;

    if (!shippingLabel || typeof shippingLabel !== 'object') return shipment;

    const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;

    return {
      ...shipment,
      packingOrder: {
        ...packingOrder,
        shippingLabel: safeShippingLabel,
      },
    };
  }

`;
    s = s.replace(marker, marker + helper);
  }

  s = s.replace(
    `    return shipment;\n  }\n}`,
    `    return this.sanitizeShipmentResponse(shipment);\n  }\n}`
  );

  if (!s.includes('return this.sanitizeShipmentResponse(shipment);')) {
    throw new Error('Sanitização da resposta de Shipment não foi instalada');
  }
  write(rel, s);
}

// 3. ManifestService: o detalhe do romaneio também contém shipment -> packingOrder -> shippingLabel.
// Removemos a mesma back-reference para impedir o mesmo 500 nessa rota.
{
  const rel = 'apps/api/src/modules/fulfillment/services/manifest.service.ts';
  let s = read(rel);

  if (!s.includes('private sanitizeManifestResponse')) {
    const ctorMatch = s.match(/  constructor\([^]*?\) \{\}\n/);
    if (!ctorMatch) throw new Error('Constructor de ManifestService não encontrado');

    const helper = `
  private sanitizeManifestResponse<T extends any>(manifest: T): T {
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.items)) {
      return manifest;
    }

    return {
      ...manifest,
      items: manifest.items.map((item: any) => {
        const shipment = item?.shipment;
        const packingOrder = shipment?.packingOrder;
        const shippingLabel = packingOrder?.shippingLabel;

        if (!shippingLabel || typeof shippingLabel !== 'object') return item;

        const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;

        return {
          ...item,
          shipment: {
            ...shipment,
            packingOrder: {
              ...packingOrder,
              shippingLabel: safeShippingLabel,
            },
          },
        };
      }),
    };
  }

`;
    s = s.replace(ctorMatch[0], ctorMatch[0] + helper);
  }

  const target = `    return manifest;\n  }\n}`;
  if (s.includes(target)) {
    s = s.replace(target, `    return this.sanitizeManifestResponse(manifest);\n  }\n}`);
  }

  if (!s.includes('return this.sanitizeManifestResponse(manifest);')) {
    throw new Error('Sanitização da resposta de Manifest não foi instalada');
  }
  write(rel, s);
}

console.log('Hotfix Sprint 8.5.2.2 aplicado.');
