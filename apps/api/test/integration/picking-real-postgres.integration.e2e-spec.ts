import { PrismaClient, PickingOrderStatus, OrderStatus, StockReservationStatus } from '@prisma/client';
import { PickingService } from '../../src/modules/fulfillment/services/picking.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('Picking Real PostgreSQL Integration Test (sem mocks)', () => {
  const dbUrlTest = process.env.DATABASE_URL_TEST;

  beforeAll(() => {
    if (!dbUrlTest || dbUrlTest.trim() === '') {
      throw new Error(
        'DATABASE_URL_TEST não foi informada. Para executar testes de integração reais com PostgreSQL, defina a variável DATABASE_URL_TEST apontando para um banco de dados isolado contendo o sufixo "_test". Exemplo: postgresql://postgres:postgres@localhost:5432/nusali_test?schema=public',
      );
    }

    if (!dbUrlTest.includes('_test')) {
      throw new Error(
        `Segurança de Dados: DATABASE_URL_TEST ("${dbUrlTest}") deve conter obrigatoriamente o sufixo "_test" no nome do banco para evitar alterações acidentais em ambiente de dev/prod.`,
      );
    }
  });

  let prismaClient: PrismaClient;
  let prismaService: PrismaService;
  let pickingService: PickingService;

  const mockAdminUser = { id: 'usr-admin-real', roles: ['ADMIN'] };

  beforeAll(async () => {
    if (!dbUrlTest || !dbUrlTest.includes('_test')) return;

    prismaClient = new PrismaClient({
      datasources: { db: { url: dbUrlTest } },
    });

    try {
      await prismaClient.$connect();
    } catch (err: any) {
      throw new Error(`Falha ao conectar no PostgreSQL de teste em ${dbUrlTest}: ${err.message}`);
    }

    pickingService = new PickingService(prismaClient as any);
  });

  afterAll(async () => {
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });

  it('deve executar teste real no PostgreSQL validando a trava do índice único parcial, idempotência, cancelamento e reuso da reserva', async () => {
    if (!dbUrlTest || !dbUrlTest.includes('_test')) return;

    const testTag = `real-${Date.now()}`;

    // Setup no banco isolado de teste usando casting seguro `as any` para inserção do seed
    const country = await prismaClient.country.create({
      data: { code: `GW-${testTag}`, name: `Guiné-Bissau ${testTag}`, flag: '🇬🇼', phonePrefix: '+245' } as any,
    });

    const currency = await prismaClient.currency.create({
      data: { code: `XF-${testTag}`, name: `Franco CFA ${testTag}`, symbol: 'CFA' } as any,
    });

    const user = await prismaClient.user.create({
      data: {
        email: `test-${testTag}@nusali.com`,
        passwordHash: 'hash-test',
        firstName: 'Test',
        lastName: 'User',
        phone: `95${Math.floor(1000000 + Math.random() * 9000000)}`,
        phoneCode: '+245',
      } as any,
    });

    const seller = await prismaClient.sellerProfile.create({
      data: {
        userId: user.id,
        countryId: country.id,
        legalName: `Seller ${testTag} Ltda`,
        taxId: `TAX-${testTag}`,
      } as any,
    });

    const store = await prismaClient.store.create({
      data: {
        name: `Store ${testTag}`,
        slug: `store-${testTag}`,
        sellerId: seller.id,
        countryId: country.id,
      } as any,
    });

    const category = await prismaClient.category.create({
      data: {
        name: `Category ${testTag}`,
        slug: `category-${testTag}`,
      } as any,
    });

    const warehouse = await prismaClient.warehouse.create({
      data: {
        code: `WH-${testTag}`,
        name: `Warehouse Test ${testTag}`,
        countryId: country.id,
      } as any,
    });

    const zone = await prismaClient.hubZone.create({
      data: {
        warehouseId: warehouse.id,
        name: `Zone ${testTag}`,
        code: `ZONE-${testTag}`,
      } as any,
    });

    const location = await prismaClient.hubLocation.create({
      data: {
        warehouseId: warehouse.id,
        zoneId: zone.id,
        code: `LOC-${testTag}`,
      } as any,
    });

    const product = await prismaClient.product.create({
      data: {
        storeId: store.id,
        categoryId: category.id,
        title: `Product Test ${testTag}`,
        slug: `product-${testTag}`,
        description: 'Descrição de teste',
      } as any,
    });

    const variant = await prismaClient.productVariant.create({
      data: {
        productId: product.id,
        sku: `VAR-${testTag}`,
        name: `Variant Test ${testTag}`,
        price: 100,
        currencyId: currency.id,
      } as any,
    });

    const inventoryItem = await prismaClient.inventoryItem.create({
      data: {
        variantId: variant.id,
        warehouseId: warehouse.id,
        locationId: location.id,
        quantityAvailable: 10,
        quantityReserved: 0,
      } as any,
    });

    const cart = await prismaClient.cart.create({
      data: {
        userId: user.id,
        currencyId: currency.id,
      } as any,
    });

    const address = await prismaClient.address.create({
      data: {
        userId: user.id,
        countryId: country.id,
        recipientName: 'Test Recipient',
        street: 'Rua Principal',
        city: 'Bissau',
        phone: '955000000',
        phoneCode: '+245',
        region: 'Bissau',
        number: '123',
      } as any,
    });

    const checkoutSession = await prismaClient.checkoutSession.create({
      data: {
        userId: user.id,
        cartId: cart.id,
        addressId: address.id,
        currencyId: currency.id,
        payloadHash: `hash-${testTag}`,
        itemsSnapshotJson: {},
        pricingSnapshotJson: {},
        shippingQuotesJson: {},
        estimatedTaxesJson: {},
        expiresAt: new Date(Date.now() + 3600000),
      } as any,
    });

    const orderGroup = await prismaClient.orderGroup.create({
      data: {
        userId: user.id,
        checkoutSessionId: checkoutSession.id,
        addressSnapshotJson: {},
        currencyId: currency.id,
        subtotal: 100,
        discountAmount: 0,
        shippingAmount: 0,
        estimatedTaxAmount: 0,
        total: 100,
      } as any,
    });

    const order = await prismaClient.order.create({
      data: {
        orderNumber: `ORD-${testTag}`,
        orderGroupId: orderGroup.id,
        userId: user.id,
        sellerId: seller.id,
        storeId: store.id,
        currencyId: currency.id,
        status: OrderStatus.PAID,
        subtotal: 100,
        discountAmount: 0,
        shippingAmount: 0,
        estimatedTaxAmount: 0,
        total: 100,
        shippingServiceCode: 'STANDARD',
        shippingServiceName: 'Entrega Padrão',
        estimatedDeliveryMinDays: 2,
        estimatedDeliveryMaxDays: 5,
        addressSnapshotJson: {},
        storeSnapshotJson: {},
        sellerSnapshotJson: {},
      } as any,
    });

    const orderItem = await prismaClient.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        variantId: variant.id,
        productTitleSnapshot: product.title,
        variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        quantity: 2,
        unitPrice: 50,
        subtotal: 100,
        discountAmount: 0,
        total: 100,
        currencyId: currency.id,
      } as any,
    });

    const stockReservation = await prismaClient.stockReservation.create({
      data: {
        orderGroupId: orderGroup.id,
        userId: user.id,
        status: StockReservationStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 86400000),
      } as any,
    });

    const stockResItem = await prismaClient.stockReservationItem.create({
      data: {
        reservationId: stockReservation.id,
        orderItemId: orderItem.id,
        variantId: variant.id,
        warehouseId: warehouse.id,
        inventoryItemId: inventoryItem.id,
        quantity: 2,
      } as any,
    });

    // 2. Executar duas criações de picking simultâneas contra o PostgreSQL real
    const results = await Promise.allSettled([
      pickingService.createPickingOrder({ orderId: order.id, warehouseId: warehouse.id }, user.id, mockAdminUser),
      pickingService.createPickingOrder({ orderId: order.id, warehouseId: warehouse.id }, user.id, mockAdminUser),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Validação de Concorrência Real com tratamento de idempotência
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled[0].status).toBe('fulfilled');

    // Confirmar que existe exatamente 1 Ordem de Picking no PostgreSQL real para esta reserva
    const dbPickingOrders = await prismaClient.pickingOrder.findMany({ where: { orderId: order.id } });
    expect(dbPickingOrders.length).toBe(1);

    const dbPickingItems = await prismaClient.pickingItem.findMany({ where: { pickingOrderId: dbPickingOrders[0].id } });
    expect(dbPickingItems.length).toBe(1);
    expect(dbPickingItems[0].stockReservationItemId).toBe(stockResItem.id);

    // 3. Teste do Método Automático Idempotente createPickingOrdersForOrder
    const autoGenResult = await pickingService.createPickingOrdersForOrder(order.id, user.id, mockAdminUser);
    expect(autoGenResult.pickingOrders.length).toBe(1);
    expect(autoGenResult.pickingOrders[0].id).toBe(dbPickingOrders[0].id);

    // 4. Cancelamento Atômico do Picking no Banco Real
    const cancelledOrder = await pickingService.cancelPicking(dbPickingOrders[0].id, { reason: 'Teste de liberação' }, user.id, mockAdminUser);
    expect(cancelledOrder.status).toBe(PickingOrderStatus.CANCELLED);

    // Confirmar que os PickingItems foram atualizados para CANCELLED no banco
    const cancelledItems = await prismaClient.pickingItem.findMany({ where: { pickingOrderId: dbPickingOrders[0].id } });
    expect(cancelledItems[0].status).toBe(PickingOrderStatus.CANCELLED);

    // 5. Reuso da Reserva após Cancelamento (O índice parcial no PostgreSQL real deve ter liberado a reserva)
    const newPickingOrder = await pickingService.createPickingOrder({ orderId: order.id, warehouseId: warehouse.id }, user.id, mockAdminUser);
    expect(newPickingOrder).toBeDefined();
    expect(newPickingOrder.id).not.toBe(dbPickingOrders[0].id);

    const newDbPickingItems = await prismaClient.pickingItem.findMany({ where: { pickingOrderId: newPickingOrder.id } });
    expect(newDbPickingItems.length).toBe(1);
    expect(newDbPickingItems[0].stockReservationItemId).toBe(stockResItem.id);
  });
});
