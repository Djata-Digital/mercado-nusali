import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryCodeService } from '../security/delivery-code.service';
import { ProofOfDeliveryService } from './proof-of-delivery.service';
import { DeliveryCodeNotificationService } from '../security/delivery-code-notification.provider';
import { DeliveryStatus, TrackingStatus } from '@prisma/client';

export interface CreateDeliveryInput {
  shipmentId: string;
  trackingId: string;
  carrierId: string;
  recipientName: string;
  recipientPhoneMasked?: string;
  addressSnapshotJson: Record<string, any>;
  scheduledDate?: Date;
  timeWindowStart?: string;
  timeWindowEnd?: string;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryCodeService: DeliveryCodeService,
    private readonly proofOfDeliveryService: ProofOfDeliveryService,
    private readonly notificationService: DeliveryCodeNotificationService,
  ) {}

  /**
   * Cria uma entrega vinculada ao Shipment e Tracking.
   * A restrição do banco de dados (índice parcial) garante no máximo 1 Delivery ativa por Shipment.
   */
  async createDelivery(input: CreateDeliveryInput) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: input.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment id ${input.shipmentId} não encontrado.`);
    }

    // Gera o código curto de entrega com hash HMAC-SHA-256
    const codeData = this.deliveryCodeService.generateCode();

    const delivery = await this.prisma.delivery.create({
      data: {
        shipmentId: input.shipmentId,
        trackingId: input.trackingId,
        carrierId: input.carrierId,
        recipientName: input.recipientName,
        recipientPhoneMasked: input.recipientPhoneMasked,
        addressSnapshotJson: input.addressSnapshotJson as any,
        deliveryCodeHash: codeData.hash,
        deliveryCodeSalt: codeData.salt,
        deliveryCodeExpiresAt: codeData.expiresAt,
        deliveryCodeMaxAttempts: codeData.maxAttempts,
        deliveryCodeChallengeId: codeData.challengeId,
        scheduledDate: input.scheduledDate,
        timeWindowStart: input.timeWindowStart,
        timeWindowEnd: input.timeWindowEnd,
        status: DeliveryStatus.CREATED,
      },
    });

    // Envia a notificação do código via SMS/Console sem expor rawDeliveryCode no corpo de resposta HTTP
    await this.notificationService.notifyRecipient(input.recipientPhoneMasked, input.recipientName, codeData.code);

    return delivery;
  }

  /**
   * Atribui Motorista e Veículo à entrega em uma ÚNICA transação atômica com trava de concorrência e retorno HTTP 409 estável.
   */
  async assignDriverAndVehicle(deliveryId: string, driverId: string, vehicleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
      });

      if (!delivery) {
        throw new NotFoundException(`Entrega id ${deliveryId} não encontrada.`);
      }

      if (([DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED, DeliveryStatus.FAILED] as any[]).includes(delivery.status)) {
        throw new BadRequestException(`Entrega no status ${delivery.status} não pode receber motorista.`);
      }

      // Validar Motorista
      const driver = await tx.logisticsDriver.findUnique({
        where: { id: driverId },
      });

      if (!driver || driver.status !== 'ACTIVE') {
        throw new BadRequestException('Motorista inválido, inativo ou suspenso.');
      }

      if (driver.licenseExpiresAt < new Date()) {
        throw new ForbiddenException(`A CNH do motorista ${driver.id} está vencida desde ${driver.licenseExpiresAt.toISOString()}.`);
      }

      // Validar Veículo
      const vehicle = await tx.logisticsVehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle || vehicle.status === 'INACTIVE' || vehicle.status === 'MAINTENANCE') {
        throw new BadRequestException('Veículo em manutenção ou inativo.');
      }

      // Validar se o motorista e veículo pertencem à mesma transportadora da entrega
      if (driver.carrierId !== delivery.carrierId || vehicle.carrierId !== delivery.carrierId) {
        throw new BadRequestException('O motorista e veículo devem pertencer à mesma transportadora da entrega.');
      }

      // Prevenção de concorrência: verificar se o motorista ou veículo já está em outra entrega ativa simultânea
      const activeDriverDelivery = await tx.delivery.findFirst({
        where: {
          driverId,
          status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] },
          id: { not: deliveryId },
        },
      });
      if (activeDriverDelivery) {
        throw new ConflictException(`O motorista '${driverId}' já está atribuído à entrega ativa '${activeDriverDelivery.id}'.`);
      }

      const activeVehicleDelivery = await tx.delivery.findFirst({
        where: {
          vehicleId,
          status: { in: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.OUT_FOR_DELIVERY] },
          id: { not: deliveryId },
        },
      });
      if (activeVehicleDelivery) {
        throw new ConflictException(`O veículo '${vehicleId}' já está atribuído à entrega ativa '${activeVehicleDelivery.id}'.`);
      }

      // Atribuição atômica via updateMany condicional na mesma transação
      const updatedCount = await tx.delivery.updateMany({
        where: {
          id: deliveryId,
          status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED, DeliveryStatus.FAILED] },
          driverId: null,
        },
        data: {
          driverId,
          vehicleId,
          status: DeliveryStatus.DRIVER_ASSIGNED,
        },
      });

      if (updatedCount.count === 0) {
        throw new ConflictException('Concorrência detectada: a entrega já foi atribuída a outro motorista ou está concluída/cancelada.');
      }

      await tx.driverAssignment.create({
        data: {
          driverId,
          vehicleId,
          status: 'ASSIGNED',
          assignedAt: new Date(),
          notes: `Atribuição para entrega id ${deliveryId}`,
        },
      });

      await tx.logisticsVehicle.update({
        where: { id: vehicleId },
        data: { status: 'ASSIGNED' },
      });

      return tx.delivery.findUnique({
        where: { id: deliveryId },
        include: { driver: true, vehicle: true },
      });
    }).catch((error: any) => {
      if (error?.code === 'P2002') {
        const target = JSON.stringify(error?.meta || {});
        if (target.includes('driver') || target.includes('DRIVER')) {
          throw new ConflictException({
            code: 'DRIVER_ALREADY_ASSIGNED',
            message: `O motorista '${driverId}' já está atribuído a um recurso ativo.`,
          });
        }
        if (target.includes('vehicle') || target.includes('VEHICLE')) {
          throw new ConflictException({
            code: 'VEHICLE_ALREADY_ASSIGNED',
            message: `O veículo '${vehicleId}' já está atribuído a um recurso ativo.`,
          });
        }
        throw new ConflictException({
          code: 'RESOURCE_ALREADY_ASSIGNED',
          message: 'Concorrência de atribuição detectada.',
        });
      }
      throw error;
    });
  }

  /**
   * Registra uma tentativa de entrega em transação atômica única com captura P2002 e retentativa/controle de conflito.
   */
  async recordAttempt(deliveryId: string, driverId: string, reason: string, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
      });

      if (!delivery) {
        throw new NotFoundException(`Entrega id ${deliveryId} não encontrada.`);
      }

      if (delivery.status === DeliveryStatus.DELIVERED || delivery.status === DeliveryStatus.CANCELLED) {
        throw new BadRequestException(`Não é possível registrar tentativa para entrega no status ${delivery.status}.`);
      }

      const nextAttemptNumber = delivery.attemptCount + 1;
      const isMaxReached = nextAttemptNumber >= delivery.maxAttempts;
      const nextStatus = isMaxReached ? DeliveryStatus.RETURNING : DeliveryStatus.ATTEMPTED;

      // Atualização condicional atômica do attemptCount
      const updatedCount = await tx.delivery.updateMany({
        where: {
          id: deliveryId,
          attemptCount: delivery.attemptCount,
        },
        data: {
          attemptCount: nextAttemptNumber,
          status: nextStatus,
          failedAt: isMaxReached ? new Date() : undefined,
          failureReason: isMaxReached ? reason : undefined,
        },
      });

      if (updatedCount.count === 0) {
        throw new ConflictException('Concorrência detectada no registro de tentativa de entrega.');
      }

      try {
        await tx.deliveryAttempt.create({
          data: {
            deliveryId,
            attemptNumber: nextAttemptNumber,
            driverId,
            status: nextStatus,
            reason,
            notes,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' || err?.message?.includes('attemptNumber')) {
          throw new ConflictException(`A tentativa nº ${nextAttemptNumber} para a entrega '${deliveryId}' já foi gravada.`);
        }
        throw err;
      }

      await tx.deliveryHistory.create({
        data: {
          deliveryId,
          previousStatus: delivery.status,
          newStatus: nextStatus,
          notes: `Tentativa ${nextAttemptNumber}/${delivery.maxAttempts}: ${reason}`,
          changedById: driverId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Delivery',
          aggregateId: deliveryId,
          eventType: isMaxReached ? 'delivery.failed' : 'delivery.attempted',
          payloadJson: {
            deliveryId,
            attemptNumber: nextAttemptNumber,
            status: nextStatus,
            reason,
          },
        },
      });

      return tx.delivery.findUnique({ where: { id: deliveryId } });
    });
  }

  async findOne(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        carrier: true,
        driver: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        vehicle: true,
        tracking: true,
        attempts: true,
        proofOfDelivery: { include: { files: true } },
        history: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Entrega id ${id} não encontrada.`);
    }

    return delivery;
  }
}
