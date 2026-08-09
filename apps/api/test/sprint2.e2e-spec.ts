import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { MinioService } from '../src/modules/storage/minio.service';
import { JwtService } from '@nestjs/jwt';
import { SellerStatus, DocumentStatus, StoreStatus, ProductStatus } from '@prisma/client';

describe('Sprint 2 Catalog, Sellers & Inventory Systems (HTTP E2E - Mocked Infrastructure)', () => {
  let app: INestApplication;
  let authToken: string;

  const mockUserActive = {
    id: 'user-seller-1',
    firstName: 'Seller',
    lastName: 'User',
    email: 'seller@example.com',
    phone: '955999888',
    phoneCode: '+245',
    passwordHash: 'hash',
    status: 'active',
    isEmailVerified: true,
    isPhoneVerified: true,
    sellerOnboardingStatus: 'IN_PROGRESS',
    countryId: 'country-gw',
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      { role: { name: 'SELLER', permissions: [{ permission: { slug: 'seller:read:self' } }] } },
      { role: { name: 'GLOBAL_ADMIN', permissions: [{ permission: { slug: 'kyc:approve' } }, { permission: { slug: 'seller:approve' } }] } },
      { role: { name: 'WAREHOUSE_MANAGER', permissions: [] } },
    ],
  };

  const mockSessionActive = {
    id: 'session-1',
    userId: 'user-seller-1',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 1000000),
    user: mockUserActive,
  };

  const mockSellerProfile = {
    id: 'seller-profile-1',
    userId: 'user-seller-1',
    sellerType: 'INDIVIDUAL',
    legalName: 'Amadou Caju Comercio',
    status: SellerStatus.VERIFIED,
    onboardingStatus: 'APPROVED',
    countryId: 'country-gw',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStore = {
    id: 'store-1',
    sellerId: 'seller-profile-1',
    countryId: 'country-gw',
    name: 'Loja Nusali Caju',
    slug: 'loja-nusali-caju',
    status: StoreStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    seller: mockSellerProfile,
  };

  const mockCategory = {
    id: 'category-1',
    name: 'Alimentos',
    slug: 'alimentos',
    status: 'ACTIVE',
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBrand = {
    id: 'brand-1',
    name: 'Nusali Agro',
    slug: 'nusali-agro',
    status: 'ACTIVE',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'product-1',
    storeId: 'store-1',
    categoryId: 'category-1',
    brandId: 'brand-1',
    title: 'Castanha de Caju Premium',
    slug: 'castanha-de-caju-premium',
    description: 'Castanha de alta qualidade.',
    condition: 'NEW',
    productType: 'PHYSICAL',
    saleScope: 'BOTH',
    saleType: 'RETAIL',
    status: ProductStatus.APPROVED,
    store: mockStore,
    category: mockCategory,
    brand: mockBrand,
    images: [{ id: 'img-1', isMain: true, fileKey: 'http://img' }],
    variants: [{ id: 'var-1', sku: 'SKU-CAJU-01', price: 5000 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWarehouse = {
    id: 'wh-1',
    countryId: 'country-gw',
    sellerId: 'seller-profile-1',
    name: 'HUB Bissau',
    code: 'HUB-GW-BIS01',
    type: 'NUSALI_HUB',
    status: 'ACTIVE',
    capacity: 50000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInventoryItem = {
    id: 'inv-1',
    variantId: 'var-1',
    warehouseId: 'wh-1',
    quantityAvailable: 100,
    quantityReserved: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: jest.fn().mockImplementation((fnOrArr) => {
      if (typeof fnOrArr === 'function') return fnOrArr(mockPrismaService);
      return Promise.all(fnOrArr);
    }),

    session: {
      findUnique: jest.fn().mockResolvedValue(mockSessionActive),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === 'user-seller-1') return Promise.resolve(mockUserActive);
        return Promise.resolve(mockUserActive);
      }),
      update: jest.fn().mockResolvedValue(mockUserActive),
    },
    country: {
      findUnique: jest.fn().mockResolvedValue({ id: 'country-gw', code: 'GW' }),
    },
    currency: {
      findUnique: jest.fn().mockResolvedValue({ id: 'curr-xof', code: 'XOF' }),
    },
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: 'role-seller', name: 'SELLER' }),
    },
    userRole: { upsert: jest.fn().mockResolvedValue({}) },
    sellerProfile: {
      findUnique: jest.fn().mockResolvedValue(mockSellerProfile),
      create: jest.fn().mockResolvedValue(mockSellerProfile),
      update: jest.fn().mockResolvedValue(mockSellerProfile),
      findMany: jest.fn().mockResolvedValue([mockSellerProfile]),
      count: jest.fn().mockResolvedValue(1),
    },
    sellerDocument: {
      create: jest.fn().mockResolvedValue({ id: 'doc-1', status: DocumentStatus.PENDING, fileKey: 'kyc/doc.pdf' }),
      findMany: jest.fn().mockResolvedValue([
        { documentType: 'IDENTITY_DOCUMENT', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'SELFIE', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'ADDRESS_PROOF', status: DocumentStatus.APPROVED, isCurrent: true },
      ]),
      findUnique: jest.fn().mockResolvedValue({ id: 'doc-1', seller: { userId: 'user-seller-1' } }),
      update: jest.fn().mockResolvedValue({ id: 'doc-1', status: DocumentStatus.APPROVED }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    sellerKycReview: { create: jest.fn().mockResolvedValue({}) },
    sellerKycEvent: { create: jest.fn().mockResolvedValue({}) },
    store: {
      findUnique: jest.fn().mockResolvedValue(mockStore),
      findFirst: jest.fn().mockResolvedValue(mockStore),
      create: jest.fn().mockResolvedValue(mockStore),
      update: jest.fn().mockResolvedValue(mockStore),
      findMany: jest.fn().mockResolvedValue([mockStore]),
      count: jest.fn().mockResolvedValue(1),
    },
    storeMember: {
      findFirst: jest.fn().mockResolvedValue({ id: 'mem-1', role: 'OWNER', status: 'ACTIVE' }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'mem-1' }),
      update: jest.fn().mockResolvedValue({ id: 'mem-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'mem-1' }),
    },
    storeInvitation: {
      create: jest.fn().mockResolvedValue({ id: 'inv-1', tokenHash: 'hash-123' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', tokenHash: 'hash-123', status: 'PENDING', email: 'seller@example.com', expiresAt: new Date(Date.now() + 100000) }),
      update: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'ACCEPTED' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    category: {
      findUnique: jest.fn().mockResolvedValue(mockCategory),
      findFirst: jest.fn().mockResolvedValue(mockCategory),
      create: jest.fn().mockResolvedValue(mockCategory),
      update: jest.fn().mockResolvedValue(mockCategory),
      findMany: jest.fn().mockResolvedValue([mockCategory]),
      count: jest.fn().mockResolvedValue(1),
    },
    brand: {
      findUnique: jest.fn().mockResolvedValue(mockBrand),
      findFirst: jest.fn().mockResolvedValue(mockBrand),
      create: jest.fn().mockResolvedValue(mockBrand),
      update: jest.fn().mockResolvedValue(mockBrand),
      findMany: jest.fn().mockResolvedValue([mockBrand]),
      count: jest.fn().mockResolvedValue(1),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue(mockProduct),
      findFirst: jest.fn().mockResolvedValue(mockProduct),
      create: jest.fn().mockResolvedValue(mockProduct),
      update: jest.fn().mockResolvedValue(mockProduct),
      findMany: jest.fn().mockResolvedValue([mockProduct]),
      count: jest.fn().mockResolvedValue(1),
    },
    productImage: {
      create: jest.fn().mockResolvedValue({ id: 'img-1', isMain: true, fileKey: 'http://img' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'img-1', isMain: true }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'img-1', isMain: true }),
      delete: jest.fn().mockResolvedValue({ id: 'img-1' }),
    },
    productVariant: {
      findUnique: jest.fn().mockResolvedValue({ id: 'var-1', sku: 'SKU-01', price: 5000, product: { storeId: 'store-1' } }),
      create: jest.fn().mockResolvedValue({ id: 'var-1', sku: 'SKU-01', price: 5000, product: { storeId: 'store-1' } }),
      update: jest.fn().mockResolvedValue({ id: 'var-1', price: 5000 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'var-1', sku: 'SKU-01', price: 5000 }]),
    },
    warehouse: {
      findUnique: jest.fn().mockResolvedValue(mockWarehouse),
      create: jest.fn().mockResolvedValue(mockWarehouse),
      update: jest.fn().mockResolvedValue(mockWarehouse),
      findMany: jest.fn().mockResolvedValue([mockWarehouse]),
      count: jest.fn().mockResolvedValue(1),
    },
    inventoryItem: {
      findUnique: jest.fn().mockResolvedValue(mockInventoryItem),
      create: jest.fn().mockResolvedValue(mockInventoryItem),
      update: jest.fn().mockResolvedValue(mockInventoryItem),
      upsert: jest.fn().mockResolvedValue(mockInventoryItem),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([mockInventoryItem]),
      count: jest.fn().mockResolvedValue(1),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
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

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    const jwtService = app.get(JwtService);
    authToken = jwtService.sign(
      { sub: 'user-seller-1', sessionId: 'session-1' },
      { secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min-32-chars' },
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Sprint 2 Endpoints Flow', () => {
    it('POST /api/v1/sellers/onboarding', async () => {
      mockPrismaService.sellerProfile.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/sellers/onboarding')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sellerType: 'INDIVIDUAL', legalName: 'Amadou Commerce', countryCode: 'GW' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('PATCH /api/v1/admin/kyc/sellers/:sellerId/approve', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/admin/kyc/sellers/seller-profile-1/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'KYC OK' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/stores', async () => {
      mockPrismaService.store.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Loja Caju', slug: 'loja-caju', countryCode: 'GW' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/stores/:storeId/members/invite', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/stores/store-1/members/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'partner@example.com', role: 'MANAGER' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/admin/categories', async () => {
      mockPrismaService.category.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Alimentos', slug: 'alimentos' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/admin/brands', async () => {
      mockPrismaService.brand.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/brands')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Nusali Agro', slug: 'nusali-agro' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/products', async () => {
      mockPrismaService.product.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storeId: 'store-1',
          categoryId: 'category-1',
          title: 'Castanha de Caju',
          slug: 'castanha-de-caju',
          description: 'Desc',
          condition: 'NEW',
          productType: 'PHYSICAL',
          saleScope: 'BOTH',
          saleType: 'RETAIL',
          countryOfOriginCode: 'GW',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/products/:productId/variants', async () => {
      mockPrismaService.productVariant.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/products/product-1/variants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sku: 'SKU-001', name: 'Var 1', price: 5000, currencyCode: 'XOF' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/public/products/:slug', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/public/products/castanha-de-caju-premium');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/warehouses', async () => {
      mockPrismaService.warehouse.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'HUB Bissau', code: 'HUB-GW-BIS01', countryCode: 'GW', type: 'SELLER_WAREHOUSE' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/inventory/adjust', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ variantId: 'var-1', warehouseId: 'wh-1', newQuantity: 100 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
