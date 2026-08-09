const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function replaceRequired(rel, before, after) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(after)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) throw new Error(`Trecho esperado não encontrado em ${rel}`);
  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.5.2 — Orders AuthZ + Fulfillment Boundary Hardening ===');

// 1) OrdersController: guardas administrativas reais.
replaceRequired(
  'apps/api/src/modules/orders/orders.controller.ts',
  `import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrderStatus } from '@prisma/client';`,
  `import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderStatus } from '@prisma/client';`
);

replaceRequired(
  'apps/api/src/modules/orders/orders.controller.ts',
  `  @Get('admin')
  async getAllAdmin(`,
  `  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS', 'SUPPORT')
  async getAllAdmin(`
);

replaceRequired(
  'apps/api/src/modules/orders/orders.controller.ts',
  `  @Patch(':id/status')
  async updateStatus(`,
  `  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS')
  async updateStatus(`
);

replaceRequired(
  'apps/api/src/modules/orders/orders.controller.ts',
  `    return this.ordersService.addComment(id, authorId, body);`,
  `    return this.ordersService.addComment(id, authorId, body, req.user);`
);

replaceRequired(
  'apps/api/src/modules/orders/orders.controller.ts',
  `    return this.ordersService.addAttachment(id, uploaderId, body);`,
  `    return this.ordersService.addAttachment(id, uploaderId, body, req.user);`
);

// 2) Seller order listing: storeId precisa pertencer ao seller/membro ativo.
replaceRequired(
  'apps/api/src/modules/orders/orders.service.ts',
  `  async findSellerOrders(userId: string, storeId?: string) {
    const where: any = {};

    if (storeId) {
      where.storeId = storeId;
    } else {
      const sellerProfile = await this.prisma.sellerProfile.findFirst({ where: { userId } });
      if (sellerProfile) {
        where.sellerId = sellerProfile.id;
      } else {
        const storeMembers = await this.prisma.storeMember.findMany({
          where: { userId, status: 'ACTIVE' },
          select: { storeId: true },
        });
        where.storeId = { in: storeMembers.map((sm) => sm.storeId) };
      }
    }`,
  `  async findSellerOrders(userId: string, storeId?: string) {
    const where: any = {};
    const sellerProfile = await this.prisma.sellerProfile.findFirst({ where: { userId } });

    if (storeId) {
      const ownedStore = sellerProfile
        ? await this.prisma.store.findFirst({
            where: { id: storeId, sellerId: sellerProfile.id },
            select: { id: true },
          })
        : null;

      const membership = await this.prisma.storeMember.findFirst({
        where: { userId, storeId, status: 'ACTIVE' },
        select: { id: true },
      });

      if (!ownedStore && !membership) {
        throw new ForbiddenException('Acesso negado aos pedidos desta loja.');
      }

      where.storeId = storeId;
    } else {
      if (sellerProfile) {
        where.sellerId = sellerProfile.id;
      } else {
        const storeMembers = await this.prisma.storeMember.findMany({
          where: { userId, status: 'ACTIVE' },
          select: { storeId: true },
        });
        where.storeId = { in: storeMembers.map((sm) => sm.storeId) };
      }
    }`
);

// 3) Comments/attachments passam pela mesma verificação de ownership.
replaceRequired(
  'apps/api/src/modules/orders/orders.service.ts',
  `  async addComment(orderId: string, authorId: string, input: AddOrderCommentInput) {
    await this.findOne(orderId);`,
  `  async addComment(orderId: string, authorId: string, input: AddOrderCommentInput, currentUser?: any) {
    await this.findOne(orderId, currentUser);`
);

replaceRequired(
  'apps/api/src/modules/orders/orders.service.ts',
  `  async addAttachment(orderId: string, uploaderId: string, input: AddOrderAttachmentInput) {
    await this.findOne(orderId);`,
  `  async addAttachment(orderId: string, uploaderId: string, input: AddOrderAttachmentInput, currentUser?: any) {
    await this.findOne(orderId, currentUser);`
);

// 4) Seller não avança READY_FOR_SHIPMENT manualmente; fulfillment é a fonte da verdade.
replaceRequired(
  'src/components/SellerHubView.tsx',
  `  const orderStatusAction = async (
    id: string,
    status: 'PREPARING' | 'READY_FOR_SHIPMENT',
  ) => {
    setActionMessage(null);
    try {
      await OrdersApi.updateSellerStatus(id, status);
      await queryClient.invalidateQueries({ queryKey: ['seller-orders-real'] });
      setActionMessage(
        status === 'PREPARING'
          ? 'Pedido marcado como em preparação no backend.'
          : 'Pedido marcado como pronto para expedição no backend.',
      );
    } catch (error: any) {
      setActionMessage(
        error?.response?.data?.message ||
          error?.message ||
          'Não foi possível atualizar o pedido.',
      );
    }
  };

`,
  ``
);

replaceRequired(
  'src/components/SellerHubView.tsx',
  `              <p className="text-xs text-gray-500 mt-1">Pedidos reais da loja. O Seller só avança PAID → PREPARING → READY_FOR_SHIPMENT; expedição/rastreamento pertencem à logística.</p>`,
  `              <p className="text-xs text-gray-500 mt-1">Pedidos reais da loja. Status de picking, packing, READY_FOR_SHIPMENT e SHIPPED são atualizados pelo fulfillment/logística, não manualmente pelo Seller.</p>`
);

const sellerActionBlock = `                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {order.status === 'PAID' && (
                        <button
                          onClick={() => void orderStatusAction(order.id, 'PREPARING')}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold"
                        >
                          Iniciar preparação
                        </button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button
                          onClick={() => void orderStatusAction(order.id, 'READY_FOR_SHIPMENT')}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold"
                        >
                          Pronto para expedição
                        </button>
                      )}
                      {order.status === 'PENDING_PAYMENT' && (
                        <span className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-bold">
                          Aguardando pagamento
                        </span>
                      )}
                      {order.status === 'READY_FOR_SHIPMENT' && (
                        <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold">
                          Aguardando logística
                        </span>
                      )}
                    </div>`;

const safeStatusBlock = `                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {order.status === 'PENDING_PAYMENT' && (
                        <span className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-bold">
                          Aguardando pagamento
                        </span>
                      )}
                      {order.status === 'PAID' && (
                        <span className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg font-bold">
                          Aguardando fulfillment
                        </span>
                      )}
                      {['PREPARING', 'READY_FOR_PICKING', 'PICKING', 'PACKING'].includes(order.status) && (
                        <span className="px-3 py-2 bg-purple-50 border border-purple-200 text-purple-800 rounded-lg font-bold">
                          Em fulfillment
                        </span>
                      )}
                      {order.status === 'READY_FOR_SHIPMENT' && (
                        <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold">
                          Aguardando expedição
                        </span>
                      )}
                    </div>`;

replaceRequired('src/components/SellerHubView.tsx', sellerActionBlock, safeStatusBlock);

// OrdersApi: remover endpoint de mudança de status do Seller do cliente comercial.
const ordersApiPath = path.join(ROOT, 'src/api/clients/OrdersApi.ts');
let ordersApi = fs.readFileSync(ordersApiPath, 'utf8');
ordersApi = ordersApi.replace(
/\n\s*static updateSellerStatus\([\s\S]*?\n\s*\}\n(?=\})/m,
'\n'
);
fs.writeFileSync(ordersApiPath, ordersApi, 'utf8');
console.log('OK src/api/clients/OrdersApi.ts');

// 5) Shipment real exige etiqueta válida; não criar tracking fallback.
replaceRequired(
  'apps/api/src/modules/fulfillment/services/shipping.service.ts',
  `    if (packingOrder.status !== PackingOrderStatus.PACKED) {
      throw new BadRequestException(\`A Ordem de Embalagem precisa estar PACKED para gerar envio. Status atual: \${packingOrder.status}\`);
    }

    const existing = await this.prisma.shipment.findUnique({`,
  `    if (packingOrder.status !== PackingOrderStatus.PACKED) {
      throw new BadRequestException(\`A Ordem de Embalagem precisa estar PACKED para gerar envio. Status atual: \${packingOrder.status}\`);
    }

    if (!packingOrder.shippingLabel || packingOrder.shippingLabel.isInvalidated) {
      throw new BadRequestException(
        'Uma ShippingLabel válida precisa existir antes de criar o Shipment.',
      );
    }

    const existing = await this.prisma.shipment.findUnique({`
);

replaceRequired(
  'apps/api/src/modules/fulfillment/services/shipping.service.ts',
  `      const trackingCode = packingOrder.shippingLabel
        ? packingOrder.shippingLabel.trackingNumber
        : \`TRK-\${shipmentCode}\`;`,
  `      const trackingCode = packingOrder.shippingLabel.trackingNumber;`
);

// Ajustar E2E existente para refletir pré-condição real da etiqueta.
replaceRequired(
  'apps/api/test/sprint5-2-fulfillment.e2e-spec.ts',
  `    it('POST /api/v1/fulfillment/shipping -> deve criar registro de envio', async () => {
      mockPackingOrder.status = PackingOrderStatus.PACKED;

      const response = await request(app.getHttpServer())`,
  `    it('POST /api/v1/fulfillment/shipping -> deve criar registro de envio', async () => {
      mockPackingOrder.status = PackingOrderStatus.PACKED;
      mockPackingOrder.shippingLabel = mockShippingLabel;

      const response = await request(app.getHttpServer())`
);

console.log('Sprint 8.5.2 aplicada. Execute checker, lint, builds e testes.');
