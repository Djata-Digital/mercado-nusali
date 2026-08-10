import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { MinioService } from '../src/modules/storage/minio.service';
import { JwtService } from '@nestjs/jwt';
import {
  WarehouseType,
  WarehouseStatus,
  HubZoneType,
  HubLocationStatus,
  InboundShipmentStatus,
  TransferOrderStatus,
  CycleCountStatus,
} from '@prisma/client';

describe('Sprint 5.1 Logistics Foundation & Concurrency (HTTP E2E)', () => {
  let app: INestApplication;
  let authToken: string;

  const mockUserAdmin = {
    id: 'user-logistics-admin-id',
    firstName: 'Logistics',
    lastName: 'Admin',
    email: 'admin.logistics@nusali.com',
    status: 'active',
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          name: 'ADMIN',
          permissions: [
            { permission: { slug: 'hub:create' } },
            { permission: { slug: 'hub:read' } },
            { permission: { slug: 'hub:update' } },
            { permission: { slug: 'hub:manage' } },
            { permission: { slug: 'zone:read' } },
            { permission: { slug: 'zone:manage' } },
            { permission: { slug: 'location:read' } },
            { permission: { slug: 'location:manage' } },
            { permission: { slug: 'inbound:read' } },
            { permission: { slug: 'inbound:create' } },
            { permission: { slug: 'inbound:inspect' } },
            { permission: { slug: 'inbound:store' } },
            { permission: { slug: 'transfer:read' } },
            { permission: { slug: 'transfer:create' } },
            { permission: { slug: 'transfer:approve' } },
            { permission: { slug: 'transfer:ship' } },
            { permission: { slug: 'transfer:receive' } },
            { permission: { slug: 'movement:read' } },
            { permission: { slug: 'movement:create' } },
            { permission: { slug: 'cyclecount:read' } },
            { permission: { slug: 'cyclecount:create' } },
            { permission: { slug: 'cyclecount:count' } },
            { permission: { slug: 'cyclecount:adjust' } },
          ],
        },
      },
    ],
  };

  const mockSessionActive = {
    id: 'session-logistics-1',
    userId: 'user-logistics-admin-id',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 1000000),
    user: mockUserAdmin,
  };

  const mockHub1 = {
    id: 'hub-1',
    code: 'HUB-GW-01',
    name: 'HUB Central Bissau E2E',
    type: WarehouseType.NUSALI_HUB,
    status: WarehouseStatus.ACTIVE,
    countryId: 'country-1',
    capacity: 5000,
    usedCapacity: 0,
    maxWeight: 50000,
    usedWeight: 0,
    maxVolume: 2000,
    usedVolume: 0,
    zones: [],
    locations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHub2 = {
    id: 'hub-2',
    code: 'HUB-GW-02',
    name: 'HUB Secundário Bafatá E2E',
    type: WarehouseType.NUSALI_HUB,
    status: WarehouseStatus.ACTIVE,
    countryId: 'country-1',
    capacity: 5000,
    usedCapacity: 0,
    maxWeight: 50000,
    usedWeight: 0,
    maxVolume: 2000,
    usedVolume: 0,
    zones: [],
    locations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockZone1 = {
    id: 'zone-1',
    warehouseId: 'hub-1',
    code: 'Z-STO-01',
    name: 'Zona de Armazenagem Principal',
    type: HubZoneType.STORAGE,
    capacity: 1000,
    usedCapacity: 0,
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLocation1 = {
    id: 'loc-1',
    warehouseId: 'hub-1',
    zoneId: 'zone-1',
    code: 'HUB-GW-01-STO-A01-R01-S01-B01',
    status: HubLocationStatus.AVAILABLE,
    capacity: 10,
    usedCapacity: 8,
    maxWeight: 500,
    currentWeight: 400,
    maxVolume: 10,
    currentVolume: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let locationUsedCapacity = 8;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    session: {
      findUnique: jest.fn().mockResolvedValue(mockSessionActive),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === 'user-logistics-admin-id') return Promise.resolve(mockUserAdmin);
        return Promise.resolve(mockUserAdmin);
      }),
    },
    warehouse: {
      findUnique: jest.fn((args) => {
        if (args?.where?.code === 'HUB-NEW-01') return Promise.resolve(null);
        if (args?.where?.id === 'hub-1' || args?.where?.code === 'HUB-GW-01') return Promise.resolve(mockHub1);
        if (args?.where?.id === 'hub-2' || args?.where?.code === 'HUB-GW-02') return Promise.resolve(mockHub2);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockHub1, mockHub2]),
      count: jest.fn().mockResolvedValue(2),
      create: jest.fn().mockResolvedValue(mockHub1),
      update: jest.fn().mockResolvedValue(mockHub1),
    },
    hubZone: {
      findUnique: jest.fn((args) => {
        if (args?.where?.warehouseId_code?.code === 'Z-NEW-01') return Promise.resolve(null);
        return Promise.resolve(mockZone1);
      }),
      findMany: jest.fn().mockResolvedValue([mockZone1]),
      create: jest.fn().mockResolvedValue(mockZone1),
      update: jest.fn().mockResolvedValue(mockZone1),
    },
    hubAisle: { create: jest.fn().mockResolvedValue({ id: 'aisle-1' }) },
    hubRack: { create: jest.fn().mockResolvedValue({ id: 'rack-1' }) },
    hubShelf: { create: jest.fn().mockResolvedValue({ id: 'shelf-1' }) },
    hubLocation: {
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...mockLocation1,
          usedCapacity: locationUsedCapacity,
        }),
      ),
      findMany: jest.fn().mockResolvedValue([mockLocation1]),
      create: jest.fn().mockResolvedValue(mockLocation1),
      update: jest.fn().mockImplementation((args) => {
        if (args?.data?.usedCapacity !== undefined) {
          locationUsedCapacity = args.data.usedCapacity;
        }
        return Promise.resolve({ ...mockLocation1, usedCapacity: locationUsedCapacity });
      }),
    },
    inboundShipment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ship-1',
        shipmentNumber: 'INB-1001',
        warehouseId: 'hub-1',
        status: InboundShipmentStatus.CREATED,
        items: [{ id: 'item-1', variantId: 'var-1', expectedQuantity: 100 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'ship-1',
        shipmentNumber: 'INB-1001',
        warehouseId: 'hub-1',
        status: InboundShipmentStatus.CREATED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({ id: 'ship-1', status: InboundShipmentStatus.STORED }),
    },
    inboundItem: { update: jest.fn().mockResolvedValue({}) },
    receivingInspection: { create: jest.fn().mockResolvedValue({ id: 'insp-1' }) },
    receivingHistory: { create: jest.fn().mockResolvedValue({ id: 'hist-1' }) },
    transferOrder: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'trf-1',
        transferNumber: 'TRF-1001',
        originWarehouseId: 'hub-1',
        destinationWarehouseId: 'hub-2',
        status: TransferOrderStatus.REQUESTED,
        items: [{ id: 'titem-1', variantId: 'var-1', quantity: 40 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'trf-1',
        transferNumber: 'TRF-1001',
        status: TransferOrderStatus.REQUESTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({ id: 'trf-1', status: TransferOrderStatus.APPROVED }),
    },
    transferItem: { update: jest.fn().mockResolvedValue({}) },
    transferHistory: { create: jest.fn().mockResolvedValue({ id: 'thist-1' }) },
    warehouseMovement: {
      create: jest.fn().mockResolvedValue({ id: 'mov-1', createdAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    cycleCount: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'cnt-1',
        countNumber: 'CNT-1001',
        warehouseId: 'hub-1',
        status: CycleCountStatus.PLANNED,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      create: jest.fn().mockResolvedValue({ id: 'cnt-1', countNumber: 'CNT-1001', createdAt: new Date() }),
      update: jest.fn().mockResolvedValue({ id: 'cnt-1', status: CycleCountStatus.COMPLETED }),
    },
    cycleCountItem: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    inventoryItem: {
      findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', quantityAvailable: 100, quantityInTransit: 0, createdAt: new Date(), updatedAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'inv-1', quantityAvailable: 100, createdAt: new Date(), updatedAt: new Date() }),
      update: jest.fn().mockResolvedValue({ id: 'inv-1', quantityAvailable: 60, createdAt: new Date(), updatedAt: new Date() }),
    },
    inventoryMovement: { create: jest.fn().mockResolvedValue({ id: 'im-1' }) },
    country: { findFirst: jest.fn().mockResolvedValue({ id: 'country-1' }), findUnique: jest.fn().mockResolvedValue({ id: 'country-1' }) },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: 'var-1' }), findUnique: jest.fn().mockResolvedValue({ id: 'var-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    getClient: jest.fn().mockReturnValue({ status: 'ready' }),
  };

  const mockMinioService = {
    uploadFile: jest.fn().mockResolvedValue({ key: 'file-key', bucket: 'nusali-public', url: 'http://minio/url' }),
    getSignedUrl: jest.fn().mockResolvedValue('http://minio/signed-url'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(MinioService)
      .useValue(mockMinioService)
      .compile();

    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/nusali?schema=public';

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const jwtService = app.get(JwtService);
    authToken = jwtService.sign(
      { sub: 'user-logistics-admin-id', sessionId: 'session-logistics-1' },
      { secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min-32-chars' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Deve criar HUBs e Zonas operacionais via REST API', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hubs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'HUB-NEW-01',
        name: 'HUB Central Bissau E2E',
        countryId: 'country-1',
        capacity: 5000,
        maxWeight: 50000,
        maxVolume: 2000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('hub-1');

    const zoneRes = await request(app.getHttpServer())
      .post('/api/v1/hubs/zones')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        warehouseId: 'hub-1',
        code: 'Z-NEW-01',
        name: 'Zona de Armazenagem Principal',
        type: HubZoneType.STORAGE,
        capacity: 1000,
      });

    expect(zoneRes.status).toBe(201);
    expect(zoneRes.body.data.id).toBe('zone-1');
  });

  it('2. Deve obter métricas de capacidade 3D do HUB (ocupação %, peso %, volume %)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/hubs/hub-1/metrics')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hubId).toBe('hub-1');
    expect(res.body.data.capacity).toBe(5000);
    expect(res.body.data.occupancyRatePercent).toBeDefined();
  });

  it('3. Concorrência: Duas requisições simultâneas tentando alocar itens em posição física limitada', async () => {
    locationUsedCapacity = 8; // Posição com capacidade max = 10, usada = 8 (2 livres)

    const req1 = request(app.getHttpServer())
      .post('/api/v1/logistics/operations/movements')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        warehouseId: 'hub-1',
        variantId: 'var-1',
        destinationLocationId: 'loc-1',
        quantity: 2,
        reason: 'Thread 1',
      });

    const req2 = request(app.getHttpServer())
      .post('/api/v1/logistics/operations/movements')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        warehouseId: 'hub-1',
        variantId: 'var-1',
        destinationLocationId: 'loc-1',
        quantity: 2,
        reason: 'Thread 2',
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    const successes = [res1, res2].filter((r) => r.status === 201);
    const failures = [res1, res2].filter((r) => r.status >= 400);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });

  it('4. Concorrência: Transferências simultâneas de produtos inter-HUB', async () => {
    const req1 = request(app.getHttpServer())
      .post('/api/v1/logistics/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        originWarehouseId: 'hub-1',
        destinationWarehouseId: 'hub-2',
        items: [{ variantId: 'var-1', quantity: 40 }],
      });

    const req2 = request(app.getHttpServer())
      .post('/api/v1/logistics/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        originWarehouseId: 'hub-1',
        destinationWarehouseId: 'hub-2',
        items: [{ variantId: 'var-1', quantity: 40 }],
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(201);
  });
});
