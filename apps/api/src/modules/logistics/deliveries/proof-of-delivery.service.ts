import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryCodeService } from '../security/delivery-code.service';
import { TrackingStateMachineService } from '../tracking/tracking-state-machine.service';
import { StorageService } from '../../storage/storage.service';
import {
  ProofOfDeliveryMethod,
  DeliveryStatus,
  TrackingStatus,
  TemporaryPodUploadStatus,
  StoreMemberStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

export interface CompleteDeliveryWithCodeInput {
  deliveryId: string;
  deliveryCode: string;
  recipientName: string;
  recipientDocumentMasked?: string;
  latitude?: number;
  longitude?: number;
  deliveredById: string;
  notes?: string;
}

export interface CompleteDeliveryWithFileInput {
  deliveryId: string;
  method: ProofOfDeliveryMethod; // SIGNATURE, PHOTO, DOCUMENT
  recipientName: string;
  fileBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  tempFileKey?: string;
  latitude?: number;
  longitude?: number;
  deliveredById: string;
  notes?: string;
}

@Injectable()
export class ProofOfDeliveryService {
  private readonly logger = new Logger(ProofOfDeliveryService.name);
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryCodeService: DeliveryCodeService,
    private readonly stateMachine: TrackingStateMachineService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Realiza o upload temporário da Prova de Entrega (POD) na pasta `temp/` e persiste na tabela TemporaryPodUpload.
   */
  async uploadTempPodFile(
    deliveryId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    createdById?: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException(`Entrega id ${deliveryId} não encontrada.`);
    }

    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(`Tipo de arquivo não permitido: ${mimeType}. Use JPG, PNG ou PDF.`);
    }

    if (fileSize > this.maxFileSize) {
      throw new BadRequestException('O tamanho da prova de entrega não pode exceder 10MB.');
    }

    const tempKey = `temp/pod/${deliveryId}/${crypto.randomUUID()}-${fileName}`;
    await this.storageService.putObject(tempKey, fileBuffer, mimeType, true);

    const validCreatedById = createdById && createdById !== 'anonymous' ? createdById : null;

    const tempUpload = await this.prisma.temporaryPodUpload.create({
      data: {
        deliveryId,
        fileKey: tempKey,
        bucket: 'nusali-pod-private',
        fileName,
        mimeType,
        fileSize,
        status: TemporaryPodUploadStatus.UPLOADED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expiracao em 24h
        createdById: validCreatedById,
      },
    });

    return { tempFileKey: tempKey, tempUploadId: tempUpload.id, expiresAt: tempUpload.expiresAt };
  }

  /**
   * Conclui a entrega utilizando validação de Código de Entrega (PIN/Code).
   */
  async completeWithCode(input: CompleteDeliveryWithCodeInput) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: input.deliveryId },
        include: { tracking: true, shipment: true },
      });

      if (!delivery) {
        throw new NotFoundException(`Entrega id ${input.deliveryId} não encontrada.`);
      }

      if (delivery.status === DeliveryStatus.DELIVERED) {
        throw new ConflictException('Esta entrega já foi concluída anteriormente.');
      }

      if (delivery.status === DeliveryStatus.CANCELLED) {
        throw new BadRequestException('Não é possível concluir uma entrega cancelada.');
      }

      if (delivery.deliveryCodeAttempts >= delivery.deliveryCodeMaxAttempts) {
        throw new ForbiddenException('Limite máximo de tentativas do código de entrega atingido.');
      }

      if (delivery.deliveryCodeExpiresAt && delivery.deliveryCodeExpiresAt < new Date()) {
        throw new BadRequestException('O código de entrega expirou.');
      }

      if (!delivery.deliveryCodeHash || !delivery.deliveryCodeSalt) {
        throw new BadRequestException('Nenhum código de entrega configurado para esta encomenda.');
      }

      await tx.delivery.update({
        where: { id: delivery.id },
        data: { deliveryCodeAttempts: { increment: 1 } },
      });

      const isValid = this.deliveryCodeService.verifyCode(
        input.deliveryCode,
        delivery.deliveryCodeHash,
        delivery.deliveryCodeSalt,
      );

      if (!isValid) {
        throw new BadRequestException('Código de entrega incorreto.');
      }

      const updatedCount = await tx.delivery.updateMany({
        where: {
          id: delivery.id,
          status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
        },
        data: {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          deliveryCodeUsedAt: new Date(),
        },
      });

      if (updatedCount.count === 0) {
        throw new ConflictException('A entrega foi alterada concorrentemente por outro operador.');
      }

      const validDeliveredById = input.deliveredById && input.deliveredById !== 'anonymous' ? input.deliveredById : null;

      const pod = await tx.proofOfDelivery.create({
        data: {
          deliveryId: delivery.id,
          method: ProofOfDeliveryMethod.DELIVERY_CODE,
          recipientName: input.recipientName,
          recipientDocumentMasked: input.recipientDocumentMasked,
          deliveryCodeVerified: true,
          latitude: input.latitude,
          longitude: input.longitude,
          deliveredById: validDeliveredById,
          notes: input.notes,
        },
      });

      await this.stateMachine.processEvent(
        {
          trackingId: delivery.trackingId,
          eventCode: 'DELIVERED',
          status: TrackingStatus.DELIVERED,
          title: 'Entregue ao Destinatário',
          description: `Entregue a ${input.recipientName} mediante confirmação de código seguro.`,
          latitude: input.latitude,
          longitude: input.longitude,
          source: undefined,
          eventAt: new Date(),
          changedById: validDeliveredById || undefined,
        },
        tx,
      );

      return pod;
    });
  }

  /**
   * Conclui a entrega utilizando Arquivo (Foto/Assinatura) com promoção de TemporaryPodUpload idempotente e rollback S3.
   */
  async completeWithFile(input: CompleteDeliveryWithFileInput) {
    let tempUploadRecord: any = null;
    let fileName = input.fileName || 'pod-file.jpg';
    let mimeType = input.mimeType || 'image/jpeg';
    let fileSize = input.fileSize || 0;
    let finalFileKey: string;

    if (input.tempFileKey) {
      tempUploadRecord = await this.prisma.temporaryPodUpload.findUnique({
        where: { fileKey: input.tempFileKey },
      });

      if (!tempUploadRecord) {
        throw new NotFoundException(`Arquivo de upload temporário '${input.tempFileKey}' não encontrado.`);
      }

      // 1. Promoção Idempotente: Se o upload já foi PROMOTED, retornar o POD existente sem repetir a operação
      if (tempUploadRecord.status === TemporaryPodUploadStatus.PROMOTED) {
        const existingPod = await this.prisma.proofOfDelivery.findUnique({
          where: { deliveryId: input.deliveryId },
          include: { files: true },
        });
        if (existingPod) return existingPod;
      }

      fileName = tempUploadRecord.fileName;
      mimeType = tempUploadRecord.mimeType;
      fileSize = tempUploadRecord.fileSize;

      finalFileKey = `pod/${input.deliveryId}/${crypto.randomUUID()}-${fileName}`;
      // Copiar objeto para a chave definitiva no MinIO/S3
      await this.storageService.copyObject(input.tempFileKey, finalFileKey, true);
    } else if (input.fileBuffer) {
      if (!this.allowedMimeTypes.includes(mimeType)) {
        throw new BadRequestException(`Tipo de arquivo não permitido: ${mimeType}. Use JPG, PNG ou PDF.`);
      }
      if (fileSize > this.maxFileSize) {
        throw new BadRequestException('O tamanho da prova de entrega não pode exceder 10MB.');
      }
      finalFileKey = `pod/${input.deliveryId}/${crypto.randomUUID()}-${fileName}`;
      await this.storageService.putObject(finalFileKey, input.fileBuffer, mimeType, true);
    } else {
      throw new BadRequestException('Nenhum arquivo ou tempFileKey fornecido para a Prova de Entrega.');
    }

    const validDeliveredById = input.deliveredById && input.deliveredById !== 'anonymous' ? input.deliveredById : null;

    // 2. Persistência atômica com compensação de rollback S3
    try {
      const pod = await this.prisma.$transaction(async (tx) => {
        const delivery = await tx.delivery.findUnique({
          where: { id: input.deliveryId },
          include: { tracking: true },
        });

        if (!delivery) {
          throw new NotFoundException(`Entrega id ${input.deliveryId} não encontrada.`);
        }

        if (delivery.status === DeliveryStatus.DELIVERED) {
          const existingPod = await tx.proofOfDelivery.findUnique({
            where: { deliveryId: delivery.id },
            include: { files: true },
          });
          if (existingPod) return existingPod;
          throw new ConflictException('Esta entrega já foi concluída anteriormente.');
        }

        const updatedCount = await tx.delivery.updateMany({
          where: {
            id: delivery.id,
            status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
          },
          data: {
            status: DeliveryStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });

        if (updatedCount.count === 0) {
          throw new ConflictException('Concorrência de entrega detectada.');
        }

        const podRecord = await tx.proofOfDelivery.create({
          data: {
            deliveryId: delivery.id,
            method: input.method,
            recipientName: input.recipientName,
            signatureFileKey: finalFileKey,
            latitude: input.latitude,
            longitude: input.longitude,
            deliveredById: validDeliveredById,
            notes: input.notes,
          },
        });

        await tx.proofOfDeliveryFile.create({
          data: {
            proofOfDeliveryId: podRecord.id,
            fileKey: finalFileKey,
            bucket: 'nusali-pod-private',
            fileName,
            mimeType,
            fileSize,
            isTemporary: false,
            promotedAt: new Date(),
          },
        });

        if (tempUploadRecord) {
          await tx.temporaryPodUpload.update({
            where: { id: tempUploadRecord.id },
            data: {
              status: TemporaryPodUploadStatus.PROMOTED,
              promotedAt: new Date(),
            },
          });
        }

        await this.stateMachine.processEvent(
          {
            trackingId: delivery.trackingId,
            eventCode: 'DELIVERED',
            status: TrackingStatus.DELIVERED,
            title: 'Entregue ao Destinatário',
            description: `Entregue a ${input.recipientName} com comprovante por ${input.method}.`,
            latitude: input.latitude,
            longitude: input.longitude,
            eventAt: new Date(),
            changedById: validDeliveredById || undefined,
          },
          tx,
        );

        return podRecord;
      });

      // Se havia um arquivo temporário promovido, remove o objeto temporário do S3/MinIO
      if (input.tempFileKey) {
        this.storageService.deleteObject(input.tempFileKey, true).catch((err) =>
          this.logger.error(`Falha ao deletar arquivo temporário S3 ${input.tempFileKey}: ${err.message}`),
        );
      }

      return pod;
    } catch (error: any) {
      // 3. Compensação S3/MinIO em caso de falha da transação no banco de dados
      if (finalFileKey) {
        this.logger.warn(`Compensando rollback S3: removendo arquivo final ${finalFileKey} após falha da transação.`);
        await this.storageService.deleteObject(finalFileKey, true).catch((err) =>
          this.logger.error(`Erro na compensação S3 do arquivo ${finalFileKey}: ${err.message}`),
        );
      }
      throw error;
    }
  }

  /**
   * Expurga uploads temporários não promovidos com trava atômica concorrente.
   */
  async cleanupOrphanTempPodFiles() {
    const expiredCutoff = new Date();
    
    // 1. Buscar registros expirados em status UPLOADED
    const candidates = await this.prisma.temporaryPodUpload.findMany({
      where: {
        status: TemporaryPodUploadStatus.UPLOADED,
        expiresAt: { lt: expiredCutoff },
      },
      take: 50,
    });

    let cleanedCount = 0;
    for (const item of candidates) {
      // 2. Trava atômica no banco mudando status para PROCESSING impedindo dois workers simultâneos
      const updated = await this.prisma.temporaryPodUpload.updateMany({
        where: {
          id: item.id,
          status: TemporaryPodUploadStatus.UPLOADED,
        },
        data: { status: TemporaryPodUploadStatus.PROCESSING },
      });

      if (updated.count === 0) continue; // Outro worker/job assumiu o registro

      try {
        await this.storageService.deleteObject(item.fileKey, true);
        await this.prisma.temporaryPodUpload.update({
          where: { id: item.id },
          data: { status: TemporaryPodUploadStatus.EXPIRED },
        });
        cleanedCount++;
      } catch (err: any) {
        await this.prisma.temporaryPodUpload.update({
          where: { id: item.id },
          data: { status: TemporaryPodUploadStatus.FAILED },
        });
        this.logger.error(`Falha ao expurgar upload temporário id ${item.id}: ${err.message}`);
      }
    }

    return { cleanedCount };
  }

  /**
   * Gera Presigned URL com autorização estrita:
   * - StoreMember precisa estar ACTIVE
   * - Comparação de motorista por LogisticsDriver.userId (não Delivery.driverId == User.id)
   * - Passar userId: null em AuditLog quando não autenticado
   */
  async getSignedUrl(fileId: string, user: any): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.prisma.proofOfDeliveryFile.findUnique({
      where: { id: fileId },
      include: {
        proofOfDelivery: {
          include: {
            delivery: {
              include: {
                shipment: {
                  include: {
                    order: {
                      include: { store: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException(`Arquivo de prova de entrega id ${fileId} não encontrado.`);
    }

    const rawUserId = typeof user === 'object' ? user?.sub || user?.id || user?.userId : user;
    const userId = rawUserId && rawUserId !== 'anonymous' ? rawUserId : null;

    const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
    const isAdmin = userRoles.some((r) => ['ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS_ADMIN'].includes(r.toUpperCase()));

    const order = file.proofOfDelivery.delivery.shipment.order;
    const isBuyer = userId ? (order.userId === userId || (order as any).buyerId === userId) : false;

    // Resolução de motorista por LogisticsDriver.userId
    let isDriver = false;
    if (userId) {
      const driverProfile = await this.prisma.logisticsDriver.findUnique({
        where: { userId },
      });
      if (driverProfile && file.proofOfDelivery.delivery.driverId === driverProfile.id) {
        isDriver = true;
      }
    }

    // Resolução de membro de loja/vendedor com status ACTIVE
    let isSeller = false;
    if (userId && !isAdmin && !isBuyer && !isDriver) {
      const storeMember = await this.prisma.storeMember.findFirst({
        where: { userId, storeId: order.storeId, status: StoreMemberStatus.ACTIVE },
      });
      if (storeMember) {
        isSeller = true;
      } else {
        const sellerProfile = await this.prisma.sellerProfile.findFirst({
          where: { userId, id: order.store?.sellerId },
        });
        if (sellerProfile) isSeller = true;
      }
    }

    if (!isBuyer && !isDriver && !isAdmin && !isSeller) {
      await this.prisma.auditLog.create({
        data: {
          userId: userId, // Passa null se for anônimo (nunca a string 'anonymous')
          action: 'POD_ACCESS_DENIED',
          entity: 'ProofOfDeliveryFile',
          entityId: fileId,
          newValue: { reason: 'Solicitação de Signed URL não autorizada' },
        },
      });
      throw new ForbiddenException('Acesso negado: você não possui autorização para visualizar este comprovante de entrega.');
    }

    const expiresInSeconds = 900; // 15 minutos
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const signedUrl = await this.storageService.getSignedUrl(file.fileKey, expiresInSeconds);

    await this.prisma.proofOfDeliveryHistory.create({
      data: {
        proofOfDeliveryId: file.proofOfDeliveryId,
        action: 'SIGNED_URL_GENERATED',
        notes: `Signed URL gerada para arquivo ${file.fileName} para o usuário ${userId || 'sistema'}`,
        performedById: userId,
      },
    });

    return { url: signedUrl, expiresAt };
  }
}
