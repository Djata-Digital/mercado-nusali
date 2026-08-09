import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PickupStatus } from '@prisma/client';

export interface CreatePickupInput {
  shipmentId: string;
  carrierId: string;
  warehouseId: string;
  scheduledDate: Date;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  notes?: string;
}

@Injectable()
export class PickupService {
  constructor(private readonly prisma: PrismaService) {}

  async createPickup(input: CreatePickupInput) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: input.shipmentId } });
    if (!shipment) throw new NotFoundException(`Shipment ${input.shipmentId} não encontrado.`);

    const existingActive = await this.prisma.pickupRequest.findFirst({
      where: {
        shipmentId: input.shipmentId,
        status: { notIn: [PickupStatus.PICKED_UP, PickupStatus.CANCELLED] },
      },
    });

    if (existingActive) {
      throw new ConflictException(`Já existe uma solicitação de coleta ativa para a remessa '${input.shipmentId}'.`);
    }

    const pickupCode = `PKP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.$transaction(async (tx) => {
      const pickup = await tx.pickupRequest.create({
        data: {
          shipmentId: input.shipmentId,
          carrierId: input.carrierId,
          warehouseId: input.warehouseId,
          pickupCode,
          scheduledDate: input.scheduledDate,
          timeWindowStart: input.timeWindowStart,
          timeWindowEnd: input.timeWindowEnd,
          notes: input.notes,
          status: PickupStatus.REQUESTED,
        },
      });

      await tx.pickupHistory.create({
        data: {
          pickupRequestId: pickup.id,
          previousStatus: null,
          newStatus: PickupStatus.REQUESTED,
          notes: 'Solicitação de coleta aberta',
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'PickupRequest',
          aggregateId: pickup.id,
          eventType: 'shipment.pickup_requested',
          payloadJson: { pickupId: pickup.id, shipmentId: input.shipmentId, pickupCode },
        },
      });

      return pickup;
    });
  }

  async findOne(id: string) {
    const pickup = await this.prisma.pickupRequest.findUnique({
      where: { id },
      include: { shipment: true, carrier: true, warehouse: true, driver: true, vehicle: true, attempts: true, history: true },
    });
    if (!pickup) throw new NotFoundException(`Coleta '${id}' não encontrada.`);
    return pickup;
  }

  async updateStatus(id: string, newStatus: PickupStatus, notes?: string, operatorId?: string) {
    const pickup = await this.findOne(id);

    const updated = await this.prisma.pickupRequest.updateMany({
      where: {
        id,
        status: { notIn: [PickupStatus.PICKED_UP, PickupStatus.CANCELLED] },
      },
      data: { status: newStatus },
    });

    if (updated.count === 0) {
      throw new ConflictException('A coleta foi finalizada ou alterada concorrentemente.');
    }

    await this.prisma.pickupHistory.create({
      data: {
        pickupRequestId: id,
        previousStatus: pickup.status,
        newStatus,
        notes: notes || `Status alterado para ${newStatus}`,
        changedById: operatorId,
      },
    });

    return this.findOne(id);
  }

  async recordAttempt(id: string, input: { driverId: string; status: PickupStatus; reason: string; notes?: string }) {
    const pickup = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const attemptCount = await tx.pickupAttempt.count({ where: { pickupRequestId: id } });
      const attemptNumber = attemptCount + 1;

      const attempt = await tx.pickupAttempt.create({
        data: {
          pickupRequestId: id,
          attemptNumber,
          driverId: input.driverId,
          status: input.status,
          reason: input.reason,
          notes: input.notes,
        },
      });

      await tx.pickupRequest.update({
        where: { id },
        data: { status: input.status },
      });

      await tx.pickupHistory.create({
        data: {
          pickupRequestId: id,
          previousStatus: pickup.status,
          newStatus: input.status,
          notes: `Tentativa ${attemptNumber}: ${input.reason}`,
          changedById: input.driverId,
        },
      });

      return attempt;
    });
  }
}
