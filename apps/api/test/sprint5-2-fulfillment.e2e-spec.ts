import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { MinioService } from '../src/modules/storage/minio.service';
import { JwtService } from '@nestjs/jwt';
import {
  PickingOrderStatus,
  PickingBatchType,
  PickingBatchStatus,
  PackingOrderStatus,
  PackingMaterialType,
  PackingMaterialStatus,
  ShipmentStatus,
  ManifestStatus,
  OrderStatus,
} from '@prisma/client';

describe('Sprint 5.2 Fulfillment E2E & Final Refinements (HTTP Integration)', () => {
  let app: INestApplication;
  let authTokenAdmin: string;
  let authTokenOperatorWh1: string;
  let authTokenOperatorWh2: string;

  const mockUserAdmin = {
    id: 'user-admin-id',
    firstName: 'Admin',
    lastName: 'Global',
    email: 'admin@nusali.com',
    status: 'active',
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          name: 'ADMIN',
          permissions: [
            { permission: { slug: 'manage_picking' } },
            { permission: { slug: 'picking:read' } },
            { permission: { slug: 'picking:manage' } },
            { permission: { slug: 'manage_packing' } },
            { permission: { slug: 'packing:read' } },
            { permission: { slug: 'packing:manage' } },
            { permission: { slug: 'manage_shipping' } },
            { permission: { slug: 'shipping:read' } },
            { permission: { slug: 'shipping:manage' } },
            { permission: { slug: 'print_labels' } },
            { permission: { slug: 'manage_manifests' } },
          ],
        },
      },
    ],
  };

  const mockUserOperatorWh1 = {
    id: 'user-wh1-operator-id',
    firstName: 'Operador',
    lastName: 'HUB Bissau',
    email: 'operator.wh1@nusali.com',
    status: 'active',
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          name: 'WAREHOUSE_OPERATOR',
          permissions: [
            { permission: { slug: 'manage_picking' } },
            { permission: { slug: 'picking:read' } },
            { permission: { slug: 'picking:manage' } },
            { permission: { slug: 'manage_packing' } },
            { permission: { slug: 'packing:read' } },
            { permission: { slug: 'packing:manage' } },
            { permission: { slug: 'manage_shipping' } },
            { permission: { slug: 'shipping:read' } },
            { permission: { slug: 'shipping:manage' } },
            { permission: { slug: 'print_labels' } },
            { permission: { slug: 'manage_manifests' } },
          ],
        },
      },
    ],
  };

  const mockUserOperatorWh2 = {
    id: 'user-wh2-operator-id',
    firstName: 'Operador',
    lastName: 'HUB Bafatá',
    email: 'operator.wh2@nusali.com',
    status: 'active',
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          name: 'WAREHOUSE_OPERATOR',
          permissions: [
            { permission: { slug: 'manage_picking' } },
            { permission: { slug: 'picking:read' } },
            { permission: { slug: 'picking:manage' } },
            { permission: { slug: 'manage_packing' } },
            { permission: { slug: 'packing:read' } },
            { permission: { slug: 'packing:manage' } },
            { permission: { slug: 'manage_shipping' } },
            { permission: { slug: 'shipping:read' } },
            { permission: { slug: 'shipping:manage' } },
            { permission: { slug: 'print_labels' } },
            { permission: { slug: 'manage_manifests' } },
          ],
        },
      },
    ],
  };

  const mockWarehouseWh1 = { id: 'e2e-wh-1', code: 'HUB-GW-01', name: 'HUB Bissau', managerId: 'user-wh1-operator-id' };
  const mockWarehouseWh2 = { id: 'e2e-wh-2', code: 'HUB-GW-02', name: 'HUB Bafatá', managerId: 'user-wh2-operator-id' };

  const mockOrder = {
    id: 'e2e-order-1',
    orderNumber: 'ORD-E2E-100',
    status: OrderStatus.PAID,
    addressSnapshotJson: {
      recipientName: 'Bakary Sagna',
      city: 'Bissau',
      street: 'Praça dos Heróis Nacionais',
    },
    items: [
      {
        id: 'e2e-order-item-1',
        variantId: 'e2e-var-1',
        quantity: 3,
        variant: { id: 'e2e-var-1', name: 'Arroz 5KG', sku: 'SKU-RICE-05' },
      },
    ],
    orderGroup: {
      stockReservations: [
        {
          id: 'res-e2e-1',
          status: 'CONFIRMED',
          items: [
            {
              id: 'res-item-e2e-1',
              orderItemId: 'e2e-order-item-1',
              variantId: 'e2e-var-1',
              warehouseId: 'e2e-wh-1',
              inventoryItemId: 'inv-item-e2e-1',
              quantity: 3,
              inventoryItem: {
                id: 'inv-item-e2e-1',
                locationId: 'e2e-loc-1',
                location: { id: 'e2e-loc-1', code: 'HUB-GW-01-STO-A01-R01-S01-B01', warehouseId: 'e2e-wh-1' },
              },
            },
          ],
        },
      ],
    },
  };

  const mockLocation = {
    id: 'e2e-loc-1',
    warehouseId: 'e2e-wh-1',
    code: 'HUB-GW-01-STO-A01-R01-S01-B01',
    status: 'AVAILABLE',
  };

  const mockPickingOrder: any = {
    id: 'e2e-pck-1',
    pickingNumber: 'PCK-E2E-100',
    orderId: 'e2e-order-1',
    warehouseId: 'e2e-wh-1',
    status: PickingOrderStatus.IN_PROGRESS,
    assignedOperatorId: 'user-wh1-operator-id',
    startedAt: new Date(),
    completedAt: null,
    cancelledAt: null,
    items: [
      {
        id: 'e2e-pitem-1',
        pickingOrderId: 'e2e-pck-1',
        orderItemId: 'e2e-order-item-1',
        variantId: 'e2e-var-1',
        locationId: 'e2e-loc-1',
        expectedQuantity: 3,
        pickedQuantity: 0,
        status: PickingOrderStatus.CREATED,
        variant: { id: 'e2e-var-1', name: 'Arroz 5KG', sku: 'SKU-RICE-05', product: { name: 'Arroz' } },
        location: mockLocation,
      },
    ],
    order: mockOrder,
    warehouse: mockWarehouseWh1,
  };

  const mockPackingMaterial = {
    id: 'e2e-mat-1',
    code: 'BOX-L-01',
    name: 'Caixa Grande',
    type: PackingMaterialType.BOX,
    ownWeight: 0.4,
    maxWeight: 25.0,
    width: 40,
    height: 30,
    length: 50,
    volume: 0.06,
    status: PackingMaterialStatus.ACTIVE,
    stockQuantity: 50,
  };

  const mockPackingOrder: any = {
    id: 'e2e-pak-1',
    packingNumber: 'PAK-E2E-100',
    pickingOrderId: 'e2e-pck-1',
    orderId: 'e2e-order-1',
    warehouseId: 'e2e-wh-1',
    materialId: 'e2e-mat-1',
    status: PackingOrderStatus.IN_PROGRESS,
    grossWeight: 5.4,
    netWeight: 5.0,
    width: 40,
    height: 30,
    length: 50,
    volumetricWeight: 12.0,
    sealCode: 'SEAL-E2E-99',
    startedAt: new Date(),
    completedAt: null,
    pickingOrder: mockPickingOrder,
    order: mockOrder,
    warehouse: mockWarehouseWh1,
    material: mockPackingMaterial,
    shippingLabel: null,
  };

  const mockShippingLabel = {
    id: 'e2e-lbl-1',
    labelNumber: 'LBL-E2E-100',
    packingOrderId: 'e2e-pak-1',
    trackingNumber: 'NUS-E2E-987654',
    qrCodeData: '{"lbl":"LBL-E2E-100"}',
    barcodeData: 'NUS-E2E-987654',
    internalCode: 'INT-PAK-E2E-100',
    carrierName: 'Mercado Nusali Express',
    recipientName: 'Bakary Sagna',
    recipientAddressJson: mockOrder.addressSnapshotJson,
    printedAt: new Date(),
    reprintCount: 1,
    isInvalidated: false,
    packingOrder: mockPackingOrder,
  };

  const mockShipment: any = {
    id: 'e2e-shp-1',
    shipmentCode: 'SHP-E2E-100',
    orderId: 'e2e-order-1',
    warehouseId: 'e2e-wh-1',
    packingOrderId: 'e2e-pak-1',
    status: ShipmentStatus.READY_TO_SHIP,
    manifestId: null,
    order: mockOrder,
    warehouse: mockWarehouseWh1,
    packingOrder: mockPackingOrder,
  };

  const mockManifest: any = {
    id: 'e2e-mnf-1',
    manifestNumber: 'MNF-E2E-100',
    warehouseId: 'e2e-wh-1',
    status: ManifestStatus.CREATED,
    driverName: 'Mamadu Djau',
    vehiclePlate: 'GB-1234',
    totalPackages: 1,
    totalWeight: 5.4,
    items: [{ id: 'e2e-mitem-1', manifestId: 'e2e-mnf-1', shipmentId: 'e2e-shp-1', shipment: mockShipment }],
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    user: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'user-admin-id') return Promise.resolve(mockUserAdmin);
        if (args?.where?.id === 'user-wh1-operator-id') return Promise.resolve(mockUserOperatorWh1);
        if (args?.where?.id === 'user-wh2-operator-id') return Promise.resolve(mockUserOperatorWh2);
        return Promise.resolve(null);
      }),
    },
    userSession: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id?.startsWith('session-')) {
          const userId = args.where.id.includes('admin')
            ? 'user-admin-id'
            : args.where.id.includes('wh1')
            ? 'user-wh1-operator-id'
            : 'user-wh2-operator-id';
          return Promise.resolve({
            id: args.where.id,
            userId,
            isRevoked: false,
            expiresAt: new Date(Date.now() + 1000000),
            user: userId === 'user-admin-id' ? mockUserAdmin : userId === 'user-wh1-operator-id' ? mockUserOperatorWh1 : mockUserOperatorWh2,
          });
        }
        return Promise.resolve(null);
      }),
    },
    order: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-order-1') return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(mockOrder),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'osh-1' }),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    },
    warehouse: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-wh-1') return Promise.resolve(mockWarehouseWh1);
        if (args?.where?.id === 'e2e-wh-2') return Promise.resolve(mockWarehouseWh2);
        return Promise.resolve(null);
      }),
      findMany: jest.fn((args) => {
        const mgrId = args?.where?.OR?.[0]?.managerId;
        if (mgrId === 'user-wh1-operator-id') return Promise.resolve([mockWarehouseWh1]);
        if (mgrId === 'user-wh2-operator-id') return Promise.resolve([mockWarehouseWh2]);
        return Promise.resolve([]);
      }),
    },
    hubLocation: {
      findFirst: jest.fn().mockResolvedValue(mockLocation),
      findUnique: jest.fn((args) => {
        if (args?.where?.code === 'HUB-GW-01-STO-A01-R01-S01-B01') return Promise.resolve(mockLocation);
        return Promise.resolve(null);
      }),
    },
    pickingOrder: {
      findFirst: jest.fn((args) => {
        if (args?.where?.orderId === 'e2e-order-1' && args?.where?.status?.notIn) return Promise.resolve(null);
        return Promise.resolve(mockPickingOrder);
      }),
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-pck-1') return Promise.resolve(mockPickingOrder);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockPickingOrder]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockPickingOrder),
      update: jest.fn().mockResolvedValue(mockPickingOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    pickingItem: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'e2e-pitem-1' }),
      update: jest.fn().mockResolvedValue({ id: 'e2e-pitem-1' }),
    },
    pickingHistory: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-phist-1' }),
    },
    packingMaterial: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-mat-1') return Promise.resolve(mockPackingMaterial);
        if (args?.where?.code === 'BOX-L-01') return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockPackingMaterial]),
      create: jest.fn().mockResolvedValue(mockPackingMaterial),
      update: jest.fn().mockResolvedValue(mockPackingMaterial),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    packingOrder: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-pak-1' || args?.where?.pickingOrderId === 'e2e-pck-1') return Promise.resolve(mockPackingOrder);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockPackingOrder]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockPackingOrder),
      update: jest.fn((args) => {
        if (args?.data?.status) mockPackingOrder.status = args.data.status;
        return Promise.resolve(mockPackingOrder);
      }),
    },
    packingItem: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-pakitem-1' }),
    },
    packingHistory: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-pakhist-1' }),
    },
    shippingLabel: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-lbl-1' || args?.where?.packingOrderId === 'e2e-pak-1') return Promise.resolve(mockShippingLabel);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockShippingLabel),
      update: jest.fn().mockResolvedValue(mockShippingLabel),
    },
    shippingLabelHistory: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-lbl-hist-1' }),
    },
    shippingManifest: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-mnf-1') return Promise.resolve(mockManifest);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockManifest]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockManifest),
      update: jest.fn().mockResolvedValue({ ...mockManifest, status: ManifestStatus.DISPATCHED }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    shippingManifestItem: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-mitem-1' }),
    },
    shipment: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'e2e-shp-1') return Promise.resolve(mockShipment);
        if (args?.where?.packingOrderId === 'e2e-pak-1') return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockShipment]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockShipment),
      update: jest.fn().mockResolvedValue({ ...mockShipment, status: ShipmentStatus.DISPATCHED }),
    },
    shipmentPackage: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-pkg-1' }),
    },
    shipmentHistory: {
      create: jest.fn().mockResolvedValue({ id: 'e2e-shist-1' }),
    },
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockMinioService = {
    uploadFile: jest.fn().mockResolvedValue('https://storage.nusali.com/labels/label-1.pdf'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(MinioService)
      .useValue(mockMinioService)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    const jwtService = app.get(JwtService);
    const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min-32-chars';
    authTokenAdmin = jwtService.sign(
      { sub: 'user-admin-id', sessionId: 'session-admin' },
      { secret: jwtSecret },
    );
    authTokenOperatorWh1 = jwtService.sign(
      { sub: 'user-wh1-operator-id', sessionId: 'session-wh1' },
      { secret: jwtSecret },
    );
    authTokenOperatorWh2 = jwtService.sign(
      { sub: 'user-wh2-operator-id', sessionId: 'session-wh2' },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. E2E Picking & Final Refinements', () => {
    it('POST /api/v1/fulfillment/picking -> deve criar Ordem de Picking para armazém reservado com localização', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/picking')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({
          orderId: 'e2e-order-1',
          warehouseId: 'e2e-wh-1',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('GET /api/v1/fulfillment/picking/e2e-pck-1 -> deve negar acesso (403) para operador do HUB-2', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/fulfillment/picking/e2e-pck-1')
        .set('Authorization', `Bearer ${authTokenOperatorWh2}`)
        .expect(403);
    });

    it('POST /api/v1/fulfillment/picking/e2e-pck-1/assign -> deve dar 409 Conflict se tentar reatribuir operador sem admin/motivo', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fulfillment/picking/e2e-pck-1/assign')
        .set('Authorization', `Bearer ${authTokenOperatorWh1}`)
        .send({ operatorId: 'user-outro-operador' })
        .expect(409);
    });
  });

  describe('2. E2E Packing & Label Printing', () => {
    it('POST /api/v1/fulfillment/packing/start -> deve iniciar embalagem', async () => {
      mockPickingOrder.status = PickingOrderStatus.PICKED;

      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/packing/start')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({ pickingOrderId: 'e2e-pck-1' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('POST /api/v1/fulfillment/packing/e2e-pak-1/complete -> deve concluir embalagem', async () => {
      mockPackingOrder.status = PackingOrderStatus.IN_PROGRESS;

      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/packing/e2e-pak-1/complete')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({
          materialId: 'e2e-mat-1',
          grossWeight: 5.4,
          width: 40,
          height: 30,
          length: 50,
          sealCode: 'SEAL-E2E-99',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('POST /api/v1/fulfillment/packing/e2e-pak-1/label -> deve gerar etiqueta', async () => {
      mockPackingOrder.status = PackingOrderStatus.PACKED;

      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/packing/e2e-pak-1/label')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({ packingOrderId: 'e2e-pak-1', carrierName: 'Transportadora E2E Real' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.labelNumber).toBe('LBL-E2E-100');
    });

    it('POST /api/v1/fulfillment/shipping/labels/e2e-lbl-1/reprint -> deve exigir motivo para reimpressão', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/shipping/labels/e2e-lbl-1/reprint')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({ reason: 'Etiqueta rasgada durante a embalagem' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('3. E2E Shipping & Manifest Flow', () => {
    it('POST /api/v1/fulfillment/shipping -> deve criar registro de envio', async () => {
      mockPackingOrder.status = PackingOrderStatus.PACKED;
      mockPackingOrder.shippingLabel = mockShippingLabel;

      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/shipping')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({ packingOrderId: 'e2e-pak-1' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('POST /api/v1/fulfillment/shipping/e2e-shp-1/dispatch -> deve impedir despacho direto do status CREATED (400)', async () => {
      mockShipment.status = ShipmentStatus.CREATED;

      await request(app.getHttpServer())
        .post('/api/v1/fulfillment/shipping/e2e-shp-1/dispatch')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .expect(400);
    });

    it('POST /api/v1/fulfillment/manifests/e2e-mnf-1/close -> deve fechar o romaneio', async () => {
      mockManifest.status = ManifestStatus.CREATED;

      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/manifests/e2e-mnf-1/close')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('POST /api/v1/fulfillment/manifests/e2e-mnf-1/dispatch -> deve despachar romaneio fechado', async () => {
      mockManifest.status = ManifestStatus.CLOSED;

      const response = await request(app.getHttpServer())
        .post('/api/v1/fulfillment/manifests/e2e-mnf-1/dispatch')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});
