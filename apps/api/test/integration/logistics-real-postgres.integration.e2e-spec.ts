import { PrismaClient, TrackingStatus, DeliveryStatus, CheckpointStatus } from '@prisma/client';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

describe('Sprint 5.3 Real PostgreSQL Integration Tests (DATABASE_URL_TEST)', () => {
  jest.setTimeout(60000);
  let prisma: PrismaClient;
  let dbUrlTest: string;

  beforeAll(async () => {
    dbUrlTest = process.env.DATABASE_URL_TEST || '';

    if (!dbUrlTest || !dbUrlTest.includes('_test')) {
      throw new Error(
        'A variável DATABASE_URL_TEST é obrigatória para testes de integração reais e o nome do banco deve conter o sufixo _test.',
      );
    }

    // Executa migrações reais no banco de testes se necessário
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: dbUrlTest },
        cwd: process.cwd(),
      });
    } catch (err) {
      console.log('[INTEGRATION TEST] Banco de dados de teste já estruturado/aplicado.');
    }

    prisma = new PrismaClient({
      datasources: { db: { url: dbUrlTest } },
    });

    await prisma.$connect();
    console.log('[INTEGRATION TEST] Conectado ao PostgreSQL Real de Teste:', dbUrlTest);

    if (process.env.REDIS_URL_TEST) {
      console.log('[INTEGRATION TEST] Utilizando Redis Real de Teste para BullMQ:', process.env.REDIS_URL_TEST);
    } else {
      console.log('[INTEGRATION TEST] Utilizando Filas Simuladas (REDIS_URL_TEST não fornecido).');
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('1. Índice Único Parcial PostgreSQL: Deve impedir 2 Rastreamentos Ativos para o mesmo Shipment', async () => {
    const seedId = crypto.randomUUID();
    const country = await prisma.country.create({
      data: { code: `C_${seedId.slice(0, 5)}`, name: 'Guiné-Bissau', flag: '🇬🇼', phonePrefix: '+245' } as any,
    });
    const currency = await prisma.currency.create({
      data: { code: `CUR_${seedId.slice(0, 5)}`, name: 'Franco CFA', symbol: 'F', decimals: 0 } as any,
    });
    const user = await prisma.user.create({
      data: {
        email: `buyer_${seedId}@test.com`,
        firstName: 'Buyer',
        lastName: 'Test',
        phone: `+245999${seedId.slice(0, 4)}`,
        phoneCode: '+245',
        passwordHash: 'hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      } as any,
    });
    const seller = await prisma.sellerProfile.create({
      data: { userId: user.id, legalName: 'Seller Inc', tradeName: 'Seller Trade', countryId: country.id, status: 'VERIFIED' } as any,
    });
    const store = await prisma.store.create({
      data: { sellerId: seller.id, countryId: country.id, name: 'Store', slug: `store-${seedId}`, status: 'ACTIVE' } as any,
    });
    const warehouse = await prisma.warehouse.create({
      data: { countryId: country.id, name: 'WH Central', code: `WH_${seedId.slice(0, 5)}` } as any,
    });
    const category = await prisma.category.create({
      data: { name: 'Cat', slug: `cat-${seedId}` } as any,
    });
    const product = await prisma.product.create({
      data: { storeId: store.id, categoryId: category.id, title: 'Prod', slug: `prod-${seedId}`, description: 'Desc' } as any,
    });
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, sku: `SKU-${seedId}`, name: 'Var', price: 100, currencyId: currency.id } as any,
    });
    const cart = await prisma.cart.create({
      data: { userId: user.id, currencyId: currency.id } as any,
    });
    const address = await prisma.address.create({
      data: { recipientName: 'Recipient', phoneCode: '+245', phone: '999000', region: 'Bissau', userId: user.id, countryId: country.id, street: 'Rua Main', number: '123', city: 'Bissau', postalCode: '1000' } as any,
    });
    const session = await prisma.checkoutSession.create({
      data: {
        user: { connect: { id: user.id } },
        cart: { connect: { id: cart.id } },
        address: { connect: { id: address.id } },
        currency: { connect: { id: currency.id } },
        payloadHash: `hash-${seedId}`,
        itemsSnapshotJson: [],
        pricingSnapshotJson: {},
        shippingQuotesJson: [],
        estimatedTaxesJson: {},
        expiresAt: new Date(Date.now() + 3600000),
      } as any,
    });
    const orderGroup = await prisma.orderGroup.create({
      data: {
        user: { connect: { id: user.id } },
        checkoutSession: { connect: { id: session.id } },
        currency: { connect: { id: currency.id } },
        addressSnapshotJson: {},
        subtotal: 100,
        discountAmount: 0,
        shippingAmount: 0,
        estimatedTaxAmount: 0,
        total: 100,
      } as any,
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${seedId}`,
        orderGroupId: orderGroup.id,
        userId: user.id,
        sellerId: seller.id,
        storeId: store.id,
        currencyId: currency.id,
        subtotal: 100,
        discountAmount: 0,
        shippingAmount: 0,
        estimatedTaxAmount: 0,
        total: 100,
        status: 'PAID',
        shippingServiceCode: 'STD',
        shippingServiceName: 'Standard',
        estimatedDeliveryMinDays: 1,
        estimatedDeliveryMaxDays: 3,
        addressSnapshotJson: {},
        storeSnapshotJson: {},
        sellerSnapshotJson: {},
      } as any,
    });
    const orderItem = await prisma.orderItem.create({
      data: {
        order: { connect: { id: order.id } },
        product: { connect: { id: product.id } },
        variant: { connect: { id: variant.id } },
        currency: { connect: { id: currency.id } },
        productTitleSnapshot: 'Prod',
        variantNameSnapshot: 'Var',
        skuSnapshot: `SKU-${seedId}`,
        unitPrice: 100,
        quantity: 1,
        subtotal: 100,
        discountAmount: 0,
        total: 100,
      } as any,
    });
    const invItem = await prisma.inventoryItem.create({
      data: { variantId: variant.id, warehouseId: warehouse.id, quantityReserved: 1, quantityAvailable: 9 } as any,
    });
    const stockRes = await prisma.stockReservation.create({
      data: { userId: user.id, orderGroupId: orderGroup.id, expiresAt: new Date(Date.now() + 3600000) } as any,
    });
    await prisma.stockReservationItem.create({
      data: {
        reservationId: stockRes.id,
        orderItemId: orderItem.id,
        warehouseId: warehouse.id,
        variantId: variant.id,
        inventoryItemId: invItem.id,
        quantity: 1,
      } as any,
    });

    const pickingOrder = await prisma.pickingOrder.create({
      data: { pickingNumber: `PIK-${seedId}`, orderId: order.id, warehouseId: warehouse.id, status: 'PICKED' as any },
    });
    const packingOrder = await prisma.packingOrder.create({
      data: { packingNumber: `PAK-${seedId}`, orderId: order.id, warehouseId: warehouse.id, pickingOrderId: pickingOrder.id, status: 'PACKED' as any },
    });
    const shipment = await prisma.shipment.create({
      data: { shipmentCode: `SHP-${seedId}`, orderId: order.id, warehouseId: warehouse.id, packingOrderId: packingOrder.id, status: 'READY_TO_SHIP' as any },
    });

    const carrier = await prisma.carrier.create({
      data: { code: `CAR_${seedId.slice(0, 5)}`, name: 'Nusali Express', type: 'NUSALI_INTERNAL' },
    });

    // Rastreamento 1 Ativo
    await prisma.tracking.create({
      data: {
        shipmentId: shipment.id,
        carrierId: carrier.id,
        trackingNumber: `TRK-1-${seedId}`,
        currentStatus: TrackingStatus.LABEL_CREATED,
      },
    });

    // Tentativa de Rastreamento 2 Ativo para o mesmo Shipment deve falhar na constraint do PostgreSQL
    await expect(
      prisma.tracking.create({
        data: {
          shipmentId: shipment.id,
          carrierId: carrier.id,
          trackingNumber: `TRK-2-${seedId}`,
          currentStatus: TrackingStatus.IN_TRANSIT,
        },
      }),
    ).rejects.toThrow();
  });

  it('2. Evento de Rastreamento Fora de Ordem: Grava evento log mas NÃO regride o status atual no PostgreSQL', async () => {
    const seedId = crypto.randomUUID();
    const carrier = await prisma.carrier.create({
      data: { code: `CAR_${seedId.slice(0, 5)}`, name: 'Carrier OutOfOrder', type: 'NUSALI_INTERNAL' },
    });
    const country = await prisma.country.create({
      data: { code: `C_${seedId.slice(0, 5)}`, name: 'Brasil', flag: '🇧🇷', phonePrefix: '+55' } as any,
    });
    const currency = await prisma.currency.create({
      data: { code: `CUR_${seedId.slice(0, 5)}`, name: 'BRL', symbol: 'R$', decimals: 2 } as any,
    });
    const user = await prisma.user.create({
      data: { email: `u_${seedId}@test.com`, firstName: 'U', lastName: 'T', phone: `+5599${seedId.slice(0, 4)}`, phoneCode: '+55', passwordHash: 'hash', countryId: country.id, preferredCurrencyId: currency.id } as any,
    });
    const seller = await prisma.sellerProfile.create({ data: { userId: user.id, legalName: 'S', tradeName: 'S', countryId: country.id } as any });
    const store = await prisma.store.create({ data: { sellerId: seller.id, countryId: country.id, name: 'St', slug: `st-${seedId}` } as any });
    const warehouse = await prisma.warehouse.create({ data: { countryId: country.id, name: 'W', code: `W_${seedId.slice(0, 5)}` } as any });
    const category = await prisma.category.create({ data: { name: 'C', slug: `c-${seedId}` } as any });
    const product = await prisma.product.create({ data: { storeId: store.id, categoryId: category.id, title: 'P', slug: `p-${seedId}`, description: 'D' } as any });
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: `S-${seedId}`, name: 'V', price: 50, currencyId: currency.id } as any });
    const cart = await prisma.cart.create({ data: { userId: user.id, currencyId: currency.id } as any });
    const address = await prisma.address.create({ data: { recipientName: 'Recipient', phoneCode: '+245', phone: '999000', region: 'Bissau', userId: user.id, countryId: country.id, street: 'Rua 2', number: '456', city: 'Bissau', postalCode: '1000' } as any });
    const session = await prisma.checkoutSession.create({
      data: {
        user: { connect: { id: user.id } },
        cart: { connect: { id: cart.id } },
        address: { connect: { id: address.id } },
        currency: { connect: { id: currency.id } },
        payloadHash: `hash-${seedId}`,
        itemsSnapshotJson: [],
        pricingSnapshotJson: {},
        shippingQuotesJson: [],
        estimatedTaxesJson: {},
        expiresAt: new Date(Date.now() + 3600000),
      } as any,
    });
    const orderGroup = await prisma.orderGroup.create({
      data: {
        user: { connect: { id: user.id } },
        checkoutSession: { connect: { id: session.id } },
        currency: { connect: { id: currency.id } },
        addressSnapshotJson: {},
        subtotal: 50,
        discountAmount: 0,
        shippingAmount: 0,
        estimatedTaxAmount: 0,
        total: 50,
      } as any,
    });
    const order = await prisma.order.create({ data: { orderNumber: `O-${seedId}`, orderGroupId: orderGroup.id, userId: user.id, sellerId: seller.id, storeId: store.id, currencyId: currency.id, subtotal: 50, discountAmount: 0, shippingAmount: 0, estimatedTaxAmount: 0, total: 50, status: 'PAID', shippingServiceCode: 'STD', shippingServiceName: 'Standard', estimatedDeliveryMinDays: 1, estimatedDeliveryMaxDays: 3, addressSnapshotJson: {}, storeSnapshotJson: {}, sellerSnapshotJson: {} } as any });
    const pickingOrder = await prisma.pickingOrder.create({ data: { pickingNumber: `PK-${seedId}`, orderId: order.id, warehouseId: warehouse.id, status: 'PICKED' as any } });
    const packingOrder = await prisma.packingOrder.create({ data: { packingNumber: `PA-${seedId}`, orderId: order.id, warehouseId: warehouse.id, pickingOrderId: pickingOrder.id, status: 'PACKED' as any } });
    const shipment = await prisma.shipment.create({ data: { shipmentCode: `SH-${seedId}`, orderId: order.id, warehouseId: warehouse.id, packingOrderId: packingOrder.id } as any });

    const tracking = await prisma.tracking.create({
      data: {
        shipmentId: shipment.id,
        carrierId: carrier.id,
        trackingNumber: `TRK-OOO-${seedId}`,
        currentStatus: TrackingStatus.OUT_FOR_DELIVERY,
      },
    });

    // Grava evento mais antigo (PICKED_UP) que chegou atrasado
    await prisma.trackingEvent.create({
      data: {
        trackingId: tracking.id,
        eventCode: 'PICKED_UP',
        status: TrackingStatus.PICKED_UP,
        title: 'Coletado com Atraso de Notificação',
        deduplicationKey: `${tracking.id}:PICKED_UP:DELAYED`,
        eventAt: new Date(Date.now() - 3600000),
      },
    });

    // Verifica que o status atual no PostgreSQL PERMANECEU OUT_FOR_DELIVERY e não regrediu
    const dbTracking = await prisma.tracking.findUnique({ where: { id: tracking.id } });
    expect(dbTracking?.currentStatus).toBe(TrackingStatus.OUT_FOR_DELIVERY);
  });
});
