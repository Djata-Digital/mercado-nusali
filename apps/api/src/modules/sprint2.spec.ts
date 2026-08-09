import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SellerProfilesService } from './seller-profiles/seller-profiles.service';
import { SellerDocumentsService } from './seller-documents/seller-documents.service';
import { StoresService } from './stores/stores.service';
import { CategoriesService } from './categories/categories.service';
import { ProductsService } from './products/products.service';
import { ProductVariantsService } from './product-variants/product-variants.service';
import { InventoryService } from './inventory/inventory.service';
import { WarehousesService } from './warehouses/warehouses.service';
import { StoreMembersService } from './store-members/store-members.service';
import { StorePermissionsService } from '../common/services/store-permissions.service';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { MinioService } from './storage/minio.service';
import { RedisService } from './redis/redis.service';
import { SellerStatus, DocumentStatus, StoreStatus, ProductStatus, StoreMemberRole, StoreMemberStatus, WarehouseType, SellerType } from '@prisma/client';
import { HashUtil } from '../common/utils/hash.util';

describe('Sprint 2 Security, Concurrency & Authorization Tests', () => {
  let sellerProfilesService: SellerProfilesService;
  let sellerDocumentsService: SellerDocumentsService;
  let storesService: StoresService;
  let productsService: ProductsService;
  let productVariantsService: ProductVariantsService;
  let inventoryService: InventoryService;
  let warehousesService: WarehousesService;
  let storeMembersService: StoreMembersService;
  let storePermissionsService: StorePermissionsService;

  let prismaService: any;
  let minioService: any;
  let redisService: any;

  beforeEach(async () => {
    prismaService = {
      sellerProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      sellerDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      sellerKycReview: { create: jest.fn() },
      sellerKycEvent: { create: jest.fn() },
      store: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      storeMember: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      storeInvitation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      brand: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      productImage: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      warehouse: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryItem: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'role-seller', name: 'SELLER' }),
      },
      userRole: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      country: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where?.code === 'GW') return Promise.resolve({ id: 'country-gw', code: 'GW' });
          return Promise.resolve(null);
        }),
      },
      currency: {
        findUnique: jest.fn().mockResolvedValue({ id: 'curr-xof', code: 'XOF' }),
      },
      $transaction: jest.fn().mockImplementation((fnOrArray) => {
        if (typeof fnOrArray === 'function') return fnOrArray(prismaService);
        return Promise.all(fnOrArray);
      }),
    };

    minioService = {
      uploadFile: jest.fn().mockResolvedValue({ key: 'kyc/file.pdf', bucket: 'nusali-private', url: 'https://minio/file.pdf' }),
      getSignedUrl: jest.fn().mockResolvedValue('https://minio/signed-private-url'),
      getPublicUrl: jest.fn().mockReturnValue('https://minio/public-url'),
    };

    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellerProfilesService,
        SellerDocumentsService,
        StoresService,
        CategoriesService,
        ProductsService,
        ProductVariantsService,
        InventoryService,
        WarehousesService,
        StoreMembersService,
        StorePermissionsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: MinioService, useValue: minioService },
        { provide: RedisService, useValue: redisService },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    sellerProfilesService = module.get<SellerProfilesService>(SellerProfilesService);
    sellerDocumentsService = module.get<SellerDocumentsService>(SellerDocumentsService);
    storesService = module.get<StoresService>(StoresService);
    productsService = module.get<ProductsService>(ProductsService);
    productVariantsService = module.get<ProductVariantsService>(ProductVariantsService);
    inventoryService = module.get<InventoryService>(InventoryService);
    warehousesService = module.get<WarehousesService>(WarehousesService);
    storeMembersService = module.get<StoreMembersService>(StoreMembersService);
    storePermissionsService = module.get<StorePermissionsService>(StorePermissionsService);
  });

  describe('1 & 2. Inventory Security & Concurrency', () => {
    it('should reject seller accessing stock of another seller', async () => {
      prismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-1',
        warehouse: { id: 'wh-1', type: WarehouseType.SELLER_WAREHOUSE, sellerId: 'seller-other' },
        variant: { product: { storeId: 'store-other' } },
      });
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-other', seller: { userId: 'user-other', status: SellerStatus.VERIFIED } });
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-me', status: SellerStatus.VERIFIED });
      prismaService.storeMember.findFirst.mockResolvedValue(null);

      await expect(
        inventoryService.getInventoryItemById('user-1', ['SELLER'], 'inv-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject unauthorized movement history reading', async () => {
      prismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-1',
        warehouse: { id: 'wh-1', type: WarehouseType.SELLER_WAREHOUSE, sellerId: 'seller-other' },
        variant: { product: { storeId: 'store-other' } },
      });
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-other', seller: { userId: 'user-other', status: SellerStatus.VERIFIED } });
      prismaService.sellerProfile.findUnique.mockResolvedValue(null);
      prismaService.storeMember.findFirst.mockResolvedValue(null);

      await expect(
        inventoryService.getMovementsByItem('user-1', ['BUYER'], 'inv-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject atomic reservation when available stock is insufficient', async () => {
      prismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-1',
        quantityAvailable: 5,
        warehouse: { id: 'wh-1', type: WarehouseType.SELLER_WAREHOUSE, sellerId: 'seller-1' },
        variant: { product: { storeId: 'store-1' } },
      });
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', status: SellerStatus.VERIFIED });
      prismaService.inventoryItem.updateMany.mockResolvedValue({ count: 0 }); // 0 rows updated due to gte condition failure

      await expect(
        inventoryService.reserveStock('user-1', ['SELLER'], { inventoryItemId: 'inv-1', quantity: 10 }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should execute concurrent reservation safely without negative stock', async () => {
      let currentStock = 10;
      prismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'inv-1',
        quantityAvailable: currentStock,
        warehouse: { id: 'wh-1', type: WarehouseType.SELLER_WAREHOUSE, sellerId: 'seller-1' },
        variant: { product: { storeId: 'store-1' } },
      });
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', status: SellerStatus.VERIFIED });

      prismaService.inventoryItem.updateMany.mockImplementation(({ where }) => {
        if (currentStock >= where.quantityAvailable.gte) {
          currentStock -= where.quantityAvailable.gte;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });

      // Simulation: Two simultaneous reservations of 8 items on stock of 10
      const res1 = inventoryService.reserveStock('user-1', ['SELLER'], { inventoryItemId: 'inv-1', quantity: 8 }, {});
      const res2 = inventoryService.reserveStock('user-1', ['SELLER'], { inventoryItemId: 'inv-1', quantity: 8 }, {});

      const results = await Promise.allSettled([res1, res2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(currentStock).toBe(2); // Stock remains positive and never negative
    });

    it('should filter listInventory in shared HUB strictly by member authorized storeId', async () => {
      prismaService.sellerProfile.findUnique.mockResolvedValue(null);
      prismaService.storeMember.findMany.mockResolvedValue([
        { storeId: 'store-authorized-1', role: StoreMemberRole.MANAGER, status: StoreMemberStatus.ACTIVE },
      ]);
      prismaService.inventoryItem.findMany.mockResolvedValue([
        { id: 'inv-item-1', variant: { product: { storeId: 'store-authorized-1' } } },
      ]);
      prismaService.inventoryItem.count.mockResolvedValue(1);

      await inventoryService.listInventory('user-store-member', ['BUYER'], {});

      expect(prismaService.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    variant: {
                      product: {
                        storeId: { in: ['store-authorized-1'] },
                      },
                    },
                  }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('should detect conflict on concurrent absolute stock definitions with expectedQuantityAvailable', async () => {
      prismaService.warehouse.findUnique.mockResolvedValue({ id: 'wh-1', type: WarehouseType.SELLER_WAREHOUSE, sellerId: 'seller-1' });
      prismaService.productVariant.findUnique.mockResolvedValue({ id: 'var-1', product: { storeId: 'store-1' } });
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', status: SellerStatus.VERIFIED });
      prismaService.inventoryItem.upsert.mockResolvedValue({ id: 'inv-1', quantityAvailable: 15 });

      // Simulate updateMany returning count: 0 (conflict)
      prismaService.inventoryItem.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        inventoryService.adjustStock('user-1', ['SELLER'], {
          variantId: 'var-1',
          warehouseId: 'wh-1',
          newQuantity: 20,
          expectedQuantityAvailable: 15,
        }, {}),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('3. Store Member Permissions', () => {
    it('should reject FINANCE member trying to edit product', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'owner-user' } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.FINANCE, status: StoreMemberStatus.ACTIVE });

      await expect(
        storePermissionsService.validateStoreAccess('user-finance', 'store-1', 'MANAGE_PRODUCTS'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject CUSTOMER_SERVICE member trying to edit product', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'owner-user' } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.CUSTOMER_SERVICE, status: StoreMemberStatus.ACTIVE });

      await expect(
        storePermissionsService.validateStoreAccess('user-cs', 'store-1', 'MANAGE_PRODUCTS'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow authorized INVENTORY_MANAGER to manage products and stock', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'owner-user', status: SellerStatus.VERIFIED } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.INVENTORY_MANAGER, status: StoreMemberStatus.ACTIVE });

      await expect(
        storePermissionsService.validateStoreAccess('user-inv', 'store-1', 'MANAGE_PRODUCTS'),
      ).resolves.not.toThrow();
    });

    it('should reject store owner if seller profile status is not VERIFIED', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'owner-user', status: SellerStatus.SUSPENDED } });

      await expect(
        storePermissionsService.validateStoreAccess('owner-user', 'store-1', 'MANAGE_PRODUCTS'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow CUSTOMER_SERVICE to VIEW_INVENTORY but reject MANAGE_INVENTORY', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'owner-user', status: SellerStatus.VERIFIED } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.CUSTOMER_SERVICE, status: StoreMemberStatus.ACTIVE });

      await expect(
        storePermissionsService.validateStoreAccess('user-cs', 'store-1', 'VIEW_INVENTORY'),
      ).resolves.not.toThrow();

      await expect(
        storePermissionsService.validateStoreAccess('user-cs', 'store-1', 'MANAGE_INVENTORY'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4 & 5. KYC Approval & Seller Role Revocation', () => {
    it('should reject KYC approval without minimum required documents', async () => {
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', userId: 'user-1', sellerType: SellerType.INDIVIDUAL });
      prismaService.sellerDocument.findMany.mockResolvedValue([]); // No approved docs

      await expect(
        sellerProfilesService.updateStatus('admin-1', 'seller-1', { status: SellerStatus.VERIFIED }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve KYC when full minimum required documents are approved', async () => {
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', userId: 'user-1', sellerType: SellerType.INDIVIDUAL });
      prismaService.sellerDocument.findMany.mockResolvedValue([
        { documentType: 'IDENTITY_DOCUMENT', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'SELFIE', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'ADDRESS_PROOF', status: DocumentStatus.APPROVED, isCurrent: true },
      ]);
      prismaService.sellerProfile.update.mockResolvedValue({ id: 'seller-1', status: SellerStatus.VERIFIED });

      const res = await sellerProfilesService.updateStatus('admin-1', 'seller-1', { status: SellerStatus.VERIFIED }, {});
      expect(res.status).toBe(SellerStatus.VERIFIED);
      expect(prismaService.userRole.upsert).toHaveBeenCalled();
    });

    it('should reject OFFICIAL_BRAND KYC approval without TRADEMARK_REGISTRATION or BRAND_AUTHORIZATION', async () => {
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', userId: 'user-1', sellerType: SellerType.OFFICIAL_BRAND });
      prismaService.sellerDocument.findMany.mockResolvedValue([
        { documentType: 'IDENTITY_DOCUMENT', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'SELFIE', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'ADDRESS_PROOF', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'BUSINESS_REGISTRATION', status: DocumentStatus.APPROVED, isCurrent: true },
        { documentType: 'TAX_DOCUMENT', status: DocumentStatus.APPROVED, isCurrent: true },
      ]); // Missing TRADEMARK_REGISTRATION or BRAND_AUTHORIZATION

      await expect(
        sellerProfilesService.updateStatus('admin-1', 'seller-1', { status: SellerStatus.VERIFIED }, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Warehouse Rules', () => {
    it('should reject unverified seller creating SELLER_WAREHOUSE', async () => {
      prismaService.sellerProfile.findUnique.mockResolvedValue({ id: 'seller-1', status: SellerStatus.PENDING });

      await expect(
        warehousesService.createWarehouse('user-1', ['SELLER'], {
          code: 'WH-01',
          name: 'Armazem',
          countryCode: 'GW',
          type: WarehouseType.SELLER_WAREHOUSE,
        }, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject WAREHOUSE_MANAGER accessing unassigned warehouse', async () => {
      prismaService.warehouse.findUnique.mockResolvedValue({ id: 'wh-1', managerId: 'user-other-manager' });

      await expect(
        warehousesService.getWarehouseById('user-manager', ['WAREHOUSE_MANAGER'], 'wh-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('7. Store Invitations Security', () => {
    it('should reject accepting invitation sent to different user email', async () => {
      const rawToken = 'token-secret';
      const tokenHash = HashUtil.hash(rawToken);

      prismaService.storeInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        tokenHash,
        email: 'original@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
      });

      prismaService.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'impostor@example.com' });

      await expect(
        storeMembersService.acceptInvitation('user-2', rawToken, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should invalidate previous pending invitations when issuing new invitation for same store & email', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'user-owner', status: SellerStatus.VERIFIED } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.OWNER, status: StoreMemberStatus.ACTIVE });
      prismaService.storeInvitation.create.mockResolvedValue({ id: 'inv-2', storeId: 'store-1', email: 'partner@example.com', expiresAt: new Date() });

      await storeMembersService.inviteMember('user-owner', 'store-1', 'partner@example.com', StoreMemberRole.MANAGER, {});
      expect(prismaService.storeInvitation.updateMany).toHaveBeenCalledWith({
        where: { storeId: 'store-1', email: 'partner@example.com', status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('8, 9, 10 & 11. Products, Images & State Flow', () => {
    it('should reject submission of product without main image (isMain: true)', async () => {
      prismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        storeId: 'store-1',
        variants: [{ id: 'var-1' }],
        images: [{ isMain: false }], // image exists but not main
      });
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'user-1', status: SellerStatus.VERIFIED } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.OWNER, status: StoreMemberStatus.ACTIVE });

      await expect(
        productsService.submitForReview('user-1', 'prod-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject INTERNATIONAL/BOTH product without valid country of origin', async () => {
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'user-1', status: SellerStatus.VERIFIED } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.OWNER, status: StoreMemberStatus.ACTIVE });

      await expect(
        productsService.createProduct('user-1', {
          storeId: 'store-1',
          categoryId: 'cat-1',
          title: 'Produto Exportacao',
          slug: 'prod-exp',
          description: 'Desc',
          condition: 'NEW' as any,
          productType: 'PHYSICAL' as any,
          saleScope: 'BOTH' as any,
          saleType: 'RETAIL' as any,
          countryOfOriginCode: 'INVALID_COUNTRY',
        }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject seller re-activating a DRAFT or PENDING_REVIEW product', async () => {
      prismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        storeId: 'store-1',
        status: ProductStatus.DRAFT,
      });
      prismaService.store.findUnique.mockResolvedValue({ id: 'store-1', seller: { userId: 'user-1', status: SellerStatus.VERIFIED } });
      prismaService.storeMember.findFirst.mockResolvedValue({ role: StoreMemberRole.OWNER, status: StoreMemberStatus.ACTIVE });

      await expect(
        productsService.activateProduct('user-1', 'prod-1', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
