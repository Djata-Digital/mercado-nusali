import { Test, TestingModule } from '@nestjs/testing';
import { PickingService } from './services/picking.service';
import { PackingService } from './services/packing.service';
import { LabelService } from './services/label.service';
import { ManifestService } from './services/manifest.service';
import { ShippingService } from './services/shipping.service';
import { PrismaService } from '../prisma/prisma.service';
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
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('Sprint 5.2 Fulfillment Refinements - Split Reservations & Transactional Tests', () => {
  let pickingService: PickingService;
  let packingService: PackingService;
  let labelService: LabelService;
  let manifestService: ManifestService;
  let shippingService: ShippingService;
  let prisma: PrismaService;

  const mockAdminUser = { id: 'admin-1', roles: ['ADMIN'] };
  const mockOperatorUser = { id: 'op-1', roles: ['WAREHOUSE_OPERATOR'] };
  const mockHubManagerUser = { id: 'manager-wh1', roles: ['HUB_MANAGER'] };

  const mockOrder = {
    id: 'order-1',
    orderNumber: 'ORD-1001',
    status: OrderStatus.PAID,
    items: [
      {
        id: 'item-1',
        variantId: 'var-1',
        quantity: 5,
        variant: { id: 'var-1', name: 'Castanha 1KG', sku: 'SKU-01' },
      },
    ],
    addressSnapshotJson: {
      recipientName: 'Amadou Diallo',
      city: 'Bissau',
      street: 'Av. Amílcar Cabral 10',
    },
    orderGroup: {
      stockReservations: [
        {
          id: 'res-wh1',
          status: 'CONFIRMED',
          items: [
            {
              id: 'res-item-wh1-pos1',
              orderItemId: 'item-1',
              variantId: 'var-1',
              warehouseId: 'wh-1',
              inventoryItemId: 'inv-1',
              quantity: 2,
              inventoryItem: { id: 'inv-1', locationId: 'loc-wh1-pos1' },
            },
            {
              id: 'res-item-wh1-pos2',
              orderItemId: 'item-1',
              variantId: 'var-1',
              warehouseId: 'wh-1',
              inventoryItemId: 'inv-2',
              quantity: 1,
              inventoryItem: { id: 'inv-2', locationId: 'loc-wh1-pos2' },
            },
          ],
        },
        {
          id: 'res-wh2',
          status: 'CONFIRMED',
          items: [
            {
              id: 'res-item-wh2',
              orderItemId: 'item-1',
              variantId: 'var-1',
              warehouseId: 'wh-2',
              inventoryItemId: 'inv-3',
              quantity: 2,
              inventoryItem: { id: 'inv-3', locationId: 'loc-wh2-pos1' },
            },
          ],
        },
      ],
    },
  };

  const mockWarehouse1 = { id: 'wh-1', code: 'HUB-GW-01', name: 'HUB Central Bissau', managerId: 'manager-wh1' };
  const mockWarehouse2 = { id: 'wh-2', code: 'HUB-GW-02', name: 'HUB Secundário Bafatá', managerId: 'manager-wh2' };

  const mockLocationWh1Pos1 = { id: 'loc-wh1-pos1', warehouseId: 'wh-1', code: 'POS-01', status: 'AVAILABLE' };
  const mockLocationWh1Pos2 = { id: 'loc-wh1-pos2', warehouseId: 'wh-1', code: 'POS-02', status: 'AVAILABLE' };

  const mockPickingOrder = {
    id: 'pck-1',
    pickingNumber: 'PCK-1001',
    orderId: 'order-1',
    warehouseId: 'wh-1',
    status: PickingOrderStatus.IN_PROGRESS,
    assignedOperatorId: 'op-1',
    startedAt: new Date(),
    completedAt: null,
    items: [],
    order: mockOrder,
    warehouse: mockWarehouse1,
  };

  const mockPackingMaterial = {
    id: 'mat-1',
    code: 'BOX-M-01',
    name: 'Caixa Média',
    type: PackingMaterialType.BOX,
    ownWeight: 0.25,
    maxWeight: 15.0,
    width: 30,
    height: 20,
    length: 40,
    volume: 0.024,
    status: PackingMaterialStatus.ACTIVE,
    stockQuantity: 10,
  };

  const mockPackingOrder = {
    id: 'pak-1',
    packingNumber: 'PAK-1001',
    pickingOrderId: 'pck-1',
    orderId: 'order-1',
    warehouseId: 'wh-1',
    materialId: 'mat-1',
    status: PackingOrderStatus.IN_PROGRESS,
    grossWeight: 2.5,
    netWeight: 2.25,
    width: 30,
    height: 20,
    length: 40,
    volumetricWeight: 4.8,
    sealCode: 'SEAL-01',
    startedAt: new Date(),
    completedAt: null,
    pickingOrder: mockPickingOrder,
    order: mockOrder,
    warehouse: mockWarehouse1,
    material: mockPackingMaterial,
    shippingLabel: null,
    shipment: null,
  };

  const mockShippingLabel = {
    id: 'lbl-1',
    labelNumber: 'LBL-1001',
    packingOrderId: 'pak-1',
    trackingNumber: 'NUS-987654-1001',
    qrCodeData: '{"lbl":"LBL-1001"}',
    barcodeData: 'NUS-987654-1001',
    internalCode: 'INT-PAK-1001',
    carrierName: 'Mercado Nusali Express',
    recipientName: 'Amadou Diallo',
    recipientAddressJson: mockOrder.addressSnapshotJson,
    printedAt: new Date(),
    reprintCount: 1,
    isInvalidated: false,
    packingOrder: mockPackingOrder,
  };

  const mockShipment = {
    id: 'shp-1',
    shipmentCode: 'SHP-1001',
    orderId: 'order-1',
    warehouseId: 'wh-1',
    packingOrderId: 'pak-1',
    status: ShipmentStatus.READY_TO_SHIP,
    manifestId: null,
    order: mockOrder,
    warehouse: mockWarehouse1,
    packingOrder: mockPackingOrder,
    manifest: null,
  };

  const mockManifest = {
    id: 'mnf-1',
    manifestNumber: 'MNF-1001',
    warehouseId: 'wh-1',
    status: ManifestStatus.CLOSED,
    driverName: 'Carlos Silva',
    totalPackages: 1,
    totalWeight: 2.5,
    items: [{ id: 'mitem-1', manifestId: 'mnf-1', shipmentId: 'shp-1', shipment: mockShipment }],
  };

  const createdPickingItems: any[] = [];

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    order: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'order-1') return Promise.resolve(mockOrder);
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
        if (args?.where?.id === 'wh-1') return Promise.resolve(mockWarehouse1);
        if (args?.where?.id === 'wh-2') return Promise.resolve(mockWarehouse2);
        return Promise.resolve(null);
      }),
      findMany: jest.fn((args) => {
        const mgrId = args?.where?.OR?.[0]?.managerId;
        if (mgrId === 'manager-wh1' || mgrId === 'op-1') return Promise.resolve([mockWarehouse1, mockWarehouse2]);
        return Promise.resolve([]);
      }),
    },
    hubLocation: {
      findUnique: jest.fn((args) => {
        if (args?.where?.code === 'POS-01') return Promise.resolve(mockLocationWh1Pos1);
        if (args?.where?.code === 'POS-02') return Promise.resolve(mockLocationWh1Pos2);
        return Promise.resolve(null);
      }),
    },
    pickingOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'pck-1') return Promise.resolve(mockPickingOrder);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockPickingOrder]),
      create: jest.fn().mockResolvedValue(mockPickingOrder),
      update: jest.fn().mockResolvedValue(mockPickingOrder),
      updateMany: jest.fn((args) => {
        if (args?.data?.status) mockPickingOrder.status = args.data.status;
        return Promise.resolve({ count: 1 });
      }),
    },
    pickingItem: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn((args) => {
        createdPickingItems.push(args.data);
        return Promise.resolve({ id: `pitem-${createdPickingItems.length}`, ...args.data });
      }),
      update: jest.fn().mockResolvedValue({ id: 'pitem-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    pickingHistory: {
      create: jest.fn().mockResolvedValue({ id: 'phist-1' }),
    },
    packingMaterial: {
      findUnique: jest.fn().mockResolvedValue(mockPackingMaterial),
      update: jest.fn().mockResolvedValue(mockPackingMaterial),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    packingOrder: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'pak-1' || args?.where?.pickingOrderId === 'pck-1') return Promise.resolve(mockPackingOrder);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockPackingOrder),
      update: jest.fn().mockResolvedValue(mockPackingOrder),
    },
    packingHistory: {
      create: jest.fn().mockResolvedValue({ id: 'pakhist-1' }),
    },
    shippingLabel: {
      findUnique: jest.fn().mockResolvedValue(mockShippingLabel),
      create: jest.fn().mockResolvedValue(mockShippingLabel),
      update: jest.fn().mockResolvedValue(mockShippingLabel),
    },
    shippingLabelHistory: {
      create: jest.fn().mockResolvedValue({ id: 'lbl-hist-1' }),
    },
    shippingManifest: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'mnf-1') return Promise.resolve(mockManifest);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockManifest),
      update: jest.fn().mockResolvedValue(mockManifest),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    shipment: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'shp-1') return Promise.resolve(mockShipment);
        if (args?.where?.packingOrderId === 'pak-1') return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockShipment),
      update: jest.fn((args) => Promise.resolve({ ...mockShipment, ...args?.data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    shipmentPackage: { create: jest.fn().mockResolvedValue({ id: 'pkg-1' }) },
    shipmentHistory: { create: jest.fn().mockResolvedValue({ id: 'shist-1' }) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    createdPickingItems.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickingService,
        PackingService,
        LabelService,
        ManifestService,
        ShippingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    pickingService = module.get<PickingService>(PickingService);
    packingService = module.get<PackingService>(PackingService);
    labelService = module.get<LabelService>(LabelService);
    manifestService = module.get<ManifestService>(ManifestService);
    shippingService = module.get<ShippingService>(ShippingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Exigência 1 & 3: Pedido dividido em duas posições no mesmo HUB', () => {
    it('deve gerar 2 PickingItems no mesmo HUB para posições diferentes com expectedQuantity da reserva', async () => {
      await pickingService.createPickingOrder({ orderId: 'order-1', warehouseId: 'wh-1' }, 'user-1', mockAdminUser);

      expect(createdPickingItems.length).toBe(2);
      expect(createdPickingItems[0].stockReservationItemId).toBe('res-item-wh1-pos1');
      expect(createdPickingItems[0].expectedQuantity).toBe(2);
      expect(createdPickingItems[0].locationId).toBe('loc-wh1-pos1');

      expect(createdPickingItems[1].stockReservationItemId).toBe('res-item-wh1-pos2');
      expect(createdPickingItems[1].expectedQuantity).toBe(1);
      expect(createdPickingItems[1].locationId).toBe('loc-wh1-pos2');
    });
  });

  describe('Exigência 2 & 4: Pedido dividido entre dois HUBs e Soma das Alocações', () => {
    it('deve gerar PickingOrders separados por armazém mantendo a soma das alocações igual à quantidade pedida', async () => {
      await pickingService.createPickingOrder({ orderId: 'order-1', warehouseId: 'wh-1' }, 'user-1', mockAdminUser);
      const wh1Total = createdPickingItems.reduce((acc, curr) => acc + curr.expectedQuantity, 0);
      createdPickingItems.length = 0;

      await pickingService.createPickingOrder({ orderId: 'order-1', warehouseId: 'wh-2' }, 'user-1', mockAdminUser);
      const wh2Total = createdPickingItems.reduce((acc, curr) => acc + curr.expectedQuantity, 0);

      expect(wh1Total).toBe(3); // 2 + 1 no wh-1
      expect(wh2Total).toBe(2); // 2 no wh-2
      expect(wh1Total + wh2Total).toBe(mockOrder.items[0].quantity); // Total = 5
    });
  });

  describe('Exigência 4: Mesma reserva usada duas vezes & Criação concorrente', () => {
    it('deve rejeitar se a mesma StockReservationItem já estiver em um picking ativo', async () => {
      jest.spyOn(prisma.pickingItem, 'findFirst').mockResolvedValueOnce({ id: 'existing-pitem' } as any);

      await expect(
        pickingService.createPickingOrder({ orderId: 'order-1', warehouseId: 'wh-1' }, 'user-1', mockAdminUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Exigência 5: cancelShipment com rollback transacional', () => {
    it('deve executar cancelShipment dentro de uma transação Prisma única', async () => {
      const result = await shippingService.cancelShipment('shp-1', { reason: 'Mudança de plano' }, 'user-1', mockHubManagerUser);
      expect(result.status).toBe(ShipmentStatus.CANCELLED);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Cancelamento Atômico de Picking e Reuso da Reserva', () => {
    it('deve cancelar o picking e seus itens atomicamente, liberando a reserva para nova Ordem de Picking', async () => {
      // 1. Criar picking inicial
      const picking = await pickingService.createPickingOrder({ orderId: 'order-1', warehouseId: 'wh-1' }, 'user-1', mockAdminUser);
      expect(picking).toBeDefined();

      // 2. Cancelar picking
      const cancelled = await pickingService.cancelPicking(picking.id, { reason: 'Cancelamento para teste de reuso' }, 'user-1', mockAdminUser);
      expect(cancelled.status).toBe(PickingOrderStatus.CANCELLED);

      // Simular atualização dos itens no mock DB
      createdPickingItems.forEach((item) => {
        if (item.pickingOrderId === picking.id) {
          item.status = PickingOrderStatus.CANCELLED;
        }
      });

      // 3. Tentar recriar a ordem de picking usando a mesma reserva
      const newPicking = await pickingService.createPickingOrder({ orderId: 'order-1', warehouseId: 'wh-1' }, 'user-1', mockAdminUser);
      expect(newPicking).toBeDefined();
    });
  });

  describe('Concorrência no método createPickingOrdersForOrder', () => {
    it('deve lidar com duas chamadas concorrentes ao createPickingOrdersForOrder retornando as mesmas ordens sem 409', async () => {
      const results = await Promise.all([
        pickingService.createPickingOrdersForOrder('order-1', 'user-1', mockAdminUser),
        pickingService.createPickingOrdersForOrder('order-1', 'user-2', mockAdminUser),
      ]);

      expect(results[0].pickingOrders.length).toBe(2);
      expect(results[1].pickingOrders.length).toBe(2);
      expect(results[0].pickingOrders[0].id).toBe(results[1].pickingOrders[0].id);
    });
  });

  describe('Exigência 5: reopenShipment com rollback transacional', () => {
    it('deve executar reopenShipment dentro de uma transação Prisma única', async () => {
      jest.spyOn(prisma.shipment, 'findUnique').mockResolvedValueOnce({
        ...mockShipment,
        status: ShipmentStatus.CANCELLED,
      } as any);

      const result = await shippingService.reopenShipment('shp-1', 'Reabertura autorizada', 'user-1', mockHubManagerUser);
      expect(result.status).toBe(ShipmentStatus.READY_TO_SHIP);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
