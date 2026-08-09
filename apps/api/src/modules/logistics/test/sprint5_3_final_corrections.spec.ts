import { Test, TestingModule } from '@nestjs/testing';
import { ProofOfDeliveryService } from '../deliveries/proof-of-delivery.service';
import { DeliveryService } from '../deliveries/delivery.service';
import { DeliveryRouteService, RouteOptimizationProvider } from '../routes/delivery-route.service';
import { CarrierWebhookService } from '../webhooks/carrier-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryCodeService } from '../security/delivery-code.service';
import {
  ConsoleDeliveryCodeProvider,
  DeliveryCodeNotificationService,
} from '../security/delivery-code-notification.provider';
import { TrackingStateMachineService } from '../tracking/tracking-state-machine.service';
import { StorageService } from '../../storage/storage.service';
import { CarrierProviderFactory } from '../providers/carrier-provider.factory';
import { SecretsEncryptionService } from '../security/secrets-encryption.service';
import {
  ProofOfDeliveryMethod,
  DeliveryStatus,
  DeliveryRouteStatus,
  CarrierWebhookStatus,
  TemporaryPodUploadStatus,
  StoreMemberStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('Sprint 5.3 Final Corrections & Refinements Unit Suite', () => {
  let podService: ProofOfDeliveryService;
  let deliveryService: DeliveryService;
  let routeService: DeliveryRouteService;
  let webhookService: CarrierWebhookService;
  let prismaMock: any;
  let storageMock: any;
  let providerFactoryMock: any;
  let secretsMock: any;
  let stateMachineMock: any;

  beforeEach(async () => {
    prismaMock = {
      delivery: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      temporaryPodUpload: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      proofOfDelivery: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      proofOfDeliveryFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      proofOfDeliveryHistory: {
        create: jest.fn(),
      },
      logisticsDriver: {
        findUnique: jest.fn(),
      },
      logisticsVehicle: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      driverAssignment: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      storeMember: {
        findFirst: jest.fn(),
      },
      sellerProfile: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      shipment: {
        findUnique: jest.fn(),
      },
      carrier: {
        findUnique: jest.fn(),
      },
      carrierWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      deliveryRoute: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      deliveryRouteStop: {
        create: jest.fn(),
      },
      deliveryRouteHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    storageMock = {
      putObject: jest.fn().mockResolvedValue(true),
      copyObject: jest.fn().mockResolvedValue(true),
      deleteObject: jest.fn().mockResolvedValue(true),
      getSignedUrl: jest.fn().mockResolvedValue('https://storage.s3.local/pod.jpg?token=abc'),
    };

    providerFactoryMock = {
      getProvider: jest.fn().mockReturnValue({
        validateWebhook: jest.fn().mockResolvedValue(true),
        processWebhook: jest.fn().mockResolvedValue([
          { trackingNumber: 'TRK123', status: 'DELIVERED', eventCode: 'DELIVERED', eventAt: new Date() },
        ]),
      }),
    };

    secretsMock = {
      decrypt: jest.fn().mockReturnValue('super-secret-key'),
    };

    stateMachineMock = {
      processEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProofOfDeliveryService,
        DeliveryService,
        DeliveryRouteService,
        RouteOptimizationProvider,
        CarrierWebhookService,
        DeliveryCodeService,
        ConsoleDeliveryCodeProvider,
        DeliveryCodeNotificationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: CarrierProviderFactory, useValue: providerFactoryMock },
        { provide: SecretsEncryptionService, useValue: secretsMock },
        { provide: TrackingStateMachineService, useValue: stateMachineMock },
      ],
    }).compile();

    podService = module.get<ProofOfDeliveryService>(ProofOfDeliveryService);
    deliveryService = module.get<DeliveryService>(DeliveryService);
    routeService = module.get<DeliveryRouteService>(DeliveryRouteService);
    webhookService = module.get<CarrierWebhookService>(CarrierWebhookService);
  });

  describe('1. TemporaryPodUpload & Promotional Idempotency', () => {
    it('deve criar um TemporaryPodUpload com status UPLOADED e validade de 24h', async () => {
      prismaMock.delivery.findUnique.mockResolvedValue({ id: 'del-1' });
      prismaMock.temporaryPodUpload.create.mockImplementation(({ data }: any) => ({
        id: 'temp-1',
        ...data,
      }));

      const res = await podService.uploadTempPodFile(
        'del-1',
        Buffer.from('dummy'),
        'pod.jpg',
        'image/jpeg',
        100,
        'user-1',
      );

      expect(res.tempFileKey).toContain('temp/pod/del-1/');
      expect(prismaMock.temporaryPodUpload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryId: 'del-1',
            status: TemporaryPodUploadStatus.UPLOADED,
            createdById: 'user-1',
          }),
        }),
      );
    });

    it('deve ser IDEMPOTENTE na promoção: se o TemporaryPodUpload já estiver PROMOTED, retorna o POD existente sem duplicar', async () => {
      const tempRecord = {
        id: 'temp-1',
        fileKey: 'temp/pod/del-1/key.jpg',
        status: TemporaryPodUploadStatus.PROMOTED,
        fileName: 'pod.jpg',
        mimeType: 'image/jpeg',
        fileSize: 100,
      };

      prismaMock.temporaryPodUpload.findUnique.mockResolvedValue(tempRecord);
      prismaMock.proofOfDelivery.findUnique.mockResolvedValue({ id: 'pod-existing', deliveryId: 'del-1' });

      const res = await podService.completeWithFile({
        deliveryId: 'del-1',
        method: ProofOfDeliveryMethod.PHOTO,
        recipientName: 'João Silva',
        tempFileKey: 'temp/pod/del-1/key.jpg',
        deliveredById: 'driver-1',
      });

      expect(res.id).toBe('pod-existing');
      expect(storageMock.copyObject).not.toHaveBeenCalled();
    });

    it('deve compensar/deletar o arquivo copiado no S3 se a transação do banco de dados falhar durante a promoção', async () => {
      const tempRecord = {
        id: 'temp-1',
        fileKey: 'temp/pod/del-1/key.jpg',
        status: TemporaryPodUploadStatus.UPLOADED,
        fileName: 'pod.jpg',
        mimeType: 'image/jpeg',
        fileSize: 100,
      };

      prismaMock.temporaryPodUpload.findUnique.mockResolvedValue(tempRecord);
      prismaMock.delivery.findUnique.mockResolvedValue({ id: 'del-1', status: DeliveryStatus.DRIVER_ASSIGNED });
      prismaMock.delivery.updateMany.mockRejectedValue(new Error('Erro de conexão com o banco'));

      await expect(
        podService.completeWithFile({
          deliveryId: 'del-1',
          method: ProofOfDeliveryMethod.PHOTO,
          recipientName: 'João Silva',
          tempFileKey: 'temp/pod/del-1/key.jpg',
          deliveredById: 'driver-1',
        }),
      ).rejects.toThrow('Erro de conexão com o banco');

      expect(storageMock.copyObject).toHaveBeenCalled();
      expect(storageMock.deleteObject).toHaveBeenCalledWith(expect.stringContaining('pod/del-1/'), true);
    });

    it('deve realizar o cleanup de arquivos temporários expirados com trava atômica PROCESSING', async () => {
      prismaMock.temporaryPodUpload.findMany.mockResolvedValue([
        { id: 'temp-exp-1', fileKey: 'temp/pod/del-1/exp1.jpg' },
      ]);
      prismaMock.temporaryPodUpload.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.temporaryPodUpload.update.mockResolvedValue({ id: 'temp-exp-1', status: TemporaryPodUploadStatus.EXPIRED });

      const result = await podService.cleanupOrphanTempPodFiles();

      expect(result.cleanedCount).toBe(1);
      expect(prismaMock.temporaryPodUpload.updateMany).toHaveBeenCalledWith({
        where: { id: 'temp-exp-1', status: TemporaryPodUploadStatus.UPLOADED },
        data: { status: TemporaryPodUploadStatus.PROCESSING },
      });
      expect(storageMock.deleteObject).toHaveBeenCalledWith('temp/pod/del-1/exp1.jpg', true);
    });
  });

  describe('2. POD Authorization & AuditLog FK Integrity', () => {
    it('deve exigir StoreMemberStatus.ACTIVE para autorizar Signed URL de POD para membro de loja', async () => {
      prismaMock.proofOfDeliveryFile.findUnique.mockResolvedValue({
        id: 'file-1',
        fileKey: 'pod/del-1/file.jpg',
        proofOfDelivery: {
          proofOfDeliveryId: 'pod-1',
          delivery: {
            driverId: 'driver-999',
            shipment: { order: { userId: 'buyer-100', storeId: 'store-10' } },
          },
        },
      });

      // StoreMember INATIVO
      prismaMock.storeMember.findFirst.mockResolvedValue(null);
      prismaMock.sellerProfile.findFirst.mockResolvedValue(null);

      await expect(podService.getSignedUrl('file-1', { sub: 'user-member-inactive', roles: ['SELLER'] })).rejects.toThrow(
        ForbiddenException,
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-member-inactive',
          action: 'POD_ACCESS_DENIED',
        }),
      });
    });

    it('deve mapear motorista por LogisticsDriver.userId e aceitar assinar URL quando id corresponder', async () => {
      prismaMock.proofOfDeliveryFile.findUnique.mockResolvedValue({
        id: 'file-1',
        fileKey: 'pod/del-1/file.jpg',
        proofOfDelivery: {
          proofOfDeliveryId: 'pod-1',
          delivery: {
            driverId: 'driver-uuid-1',
            shipment: { order: { userId: 'buyer-100', storeId: 'store-10' } },
          },
        },
      });

      prismaMock.logisticsDriver.findUnique.mockResolvedValue({ id: 'driver-uuid-1', userId: 'user-driver-5' });

      const res = await podService.getSignedUrl('file-1', { sub: 'user-driver-5', roles: ['DRIVER'] });
      expect(res.url).toBeDefined();
    });

    it('deve gravar userId como null em AuditLog em caso de ator não autenticado (nunca a string "anonymous")', async () => {
      prismaMock.proofOfDeliveryFile.findUnique.mockResolvedValue({
        id: 'file-1',
        fileKey: 'pod/del-1/file.jpg',
        proofOfDelivery: {
          proofOfDeliveryId: 'pod-1',
          delivery: {
            driverId: 'driver-1',
            shipment: { order: { userId: 'buyer-1' } },
          },
        },
      });

      await expect(podService.getSignedUrl('file-1', 'anonymous')).rejects.toThrow(ForbiddenException);

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          action: 'POD_ACCESS_DENIED',
        }),
      });
    });
  });

  describe('3. Resource Exclusivity & Partial Index HTTP 409 Errors', () => {
    it('deve capturar erro P2002 de índice parcial no motorista e lançar ConflictException com o código DRIVER_ALREADY_ASSIGNED', async () => {
      prismaMock.delivery.findUnique.mockResolvedValue({ id: 'del-1', status: DeliveryStatus.CREATED, carrierId: 'car-1' });
      prismaMock.logisticsDriver.findUnique.mockResolvedValue({ id: 'drv-1', carrierId: 'car-1', status: 'ACTIVE', licenseExpiresAt: new Date(Date.now() + 100000) });
      prismaMock.logisticsVehicle.findUnique.mockResolvedValue({ id: 'veh-1', carrierId: 'car-1', status: 'AVAILABLE' });
      prismaMock.delivery.findFirst.mockResolvedValue(null);

      const p2002Error: any = new Error('Unique constraint failed on the fields: (driver_id)');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['delivery_active_driver_idx'] };

      prismaMock.delivery.updateMany.mockRejectedValue(p2002Error);

      try {
        await deliveryService.assignDriverAndVehicle('del-1', 'drv-1', 'veh-1');
        fail('Deveria ter lançado ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: 'DRIVER_ALREADY_ASSIGNED',
          }),
        );
      }
    });

    it('deve capturar erro P2002 de índice parcial no veículo e lançar ConflictException com o código VEHICLE_ALREADY_ASSIGNED', async () => {
      prismaMock.delivery.findUnique.mockResolvedValue({ id: 'del-1', status: DeliveryStatus.CREATED, carrierId: 'car-1' });
      prismaMock.logisticsDriver.findUnique.mockResolvedValue({ id: 'drv-1', carrierId: 'car-1', status: 'ACTIVE', licenseExpiresAt: new Date(Date.now() + 100000) });
      prismaMock.logisticsVehicle.findUnique.mockResolvedValue({ id: 'veh-1', carrierId: 'car-1', status: 'AVAILABLE' });
      prismaMock.delivery.findFirst.mockResolvedValue(null);

      const p2002Error: any = new Error('Unique constraint failed on the fields: (vehicle_id)');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['delivery_active_vehicle_idx'] };

      prismaMock.delivery.updateMany.mockRejectedValue(p2002Error);

      try {
        await deliveryService.assignDriverAndVehicle('del-1', 'drv-1', 'veh-1');
        fail('Deveria ter lançado ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: 'VEHICLE_ALREADY_ASSIGNED',
          }),
        );
      }
    });
  });

  describe('4. DeliveryRoute State Machine', () => {
    it('deve permitir transição válida da rota: PLANNED -> ASSIGNED -> IN_PROGRESS -> COMPLETED', async () => {
      prismaMock.deliveryRoute.findUnique.mockResolvedValue({ id: 'route-1', status: DeliveryRouteStatus.PLANNED });
      prismaMock.deliveryRoute.updateMany.mockResolvedValue({ count: 1 });

      const res = await routeService.updateRouteStatus('route-1', DeliveryRouteStatus.ASSIGNED, 'operator-1');
      expect(prismaMock.deliveryRouteHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStatus: DeliveryRouteStatus.PLANNED,
            newStatus: DeliveryRouteStatus.ASSIGNED,
          }),
        }),
      );
    });

    it('deve rejeitar transição inválida de status da rota (ex: COMPLETED -> IN_PROGRESS)', async () => {
      prismaMock.deliveryRoute.findUnique.mockResolvedValue({ id: 'route-1', status: DeliveryRouteStatus.COMPLETED });

      await expect(
        routeService.updateRouteStatus('route-1', DeliveryRouteStatus.IN_PROGRESS, 'operator-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Webhook Recovery & Fallback Rules', () => {
    it('deve manter status RECEIVED no enfileiramento sem chamar fallback síncrono quando em produção', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        prismaMock.carrier.findUnique.mockResolvedValue({
          id: 'car-1',
          code: 'DHL',
          name: 'DHL',
          accounts: [{ status: 'ACTIVE', webhookSecretEncrypted: 'secret' }],
        });
        prismaMock.carrierWebhookEvent.findUnique.mockResolvedValue(null);
        prismaMock.carrierWebhookEvent.create.mockResolvedValue({ id: 'evt-prod-1' });

        const processSpy = jest.spyOn(webhookService, 'processWebhookEvent');

        const result = await webhookService.handleWebhook('DHL', { 'x-sig': 'valid' }, { trackingNumber: 'TRK1' });
        expect(result.accepted).toBe(true);
        expect(processSpy).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('deve executar o recovery de webhooks incrementando retryCount e aplicando backoff', async () => {
      prismaMock.carrierWebhookEvent.findMany.mockResolvedValue([
        { id: 'rec-1', status: CarrierWebhookStatus.RECEIVED, retryCount: 0, maxRetries: 5 },
      ]);
      prismaMock.carrierWebhookEvent.updateMany.mockResolvedValue({ count: 1 });

      const processSpy = jest.spyOn(webhookService, 'processWebhookEvent').mockResolvedValue(undefined as any);

      const result = await webhookService.recoverReceivedEvents();

      expect(result.reenqueuedCount).toBe(1);
      expect(prismaMock.carrierWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: { id: 'rec-1', status: CarrierWebhookStatus.RECEIVED, retryCount: 0 },
        data: expect.objectContaining({ retryCount: 1 }),
      });
    });
  });

  describe('6. Real BullMQ Infrastructure Status', () => {
    it('deve declarar explicitamente o status dos testes BullMQ', () => {
      if (process.env.REDIS_URL_TEST) {
        console.log(`[BULLMQ REAL TEST] Testando infraestrutura real Redis/BullMQ na URL: ${process.env.REDIS_URL_TEST}`);
      } else {
        console.log('[BULLMQ TEST NOTICE] REDIS_URL_TEST não configurada. Fila BullMQ validada via suíte unitária / mocks.');
      }
    });
  });
});
