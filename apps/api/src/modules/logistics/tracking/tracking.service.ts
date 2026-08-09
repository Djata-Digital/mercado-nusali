import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingStateMachineService } from './tracking-state-machine.service';
import { PublicTrackingMapper } from './public-tracking.mapper';
import { TrackingStatus, TrackingEventSource } from '@prisma/client';
import * as crypto from 'crypto';

export interface CreateTrackingInput {
  shipmentId: string;
  carrierId: string;
  trackingNumber?: string;
  externalTrackingNumber?: string;
  originCountryId?: string;
  destinationCountryId?: string;
  estimatedDeliveryAt?: Date;
  isInternational?: boolean;
  replaceActive?: boolean;
  createdById?: string;
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: TrackingStateMachineService,
  ) {}

  /**
   * Cria um rastreamento único ativo para um Shipment.
   * Executado em transação Serializable com tratamento de trava e concorrência P2002.
   */
  async createTracking(input: CreateTrackingInput) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const shipment = await tx.shipment.findUnique({
            where: { id: input.shipmentId },
            include: { order: true },
          });

          if (!shipment) {
            throw new NotFoundException(`Shipment id ${input.shipmentId} não encontrado.`);
          }

          // Buscar se já existe rastreamento ativo
          const activeTracking = await tx.tracking.findFirst({
            where: {
              shipmentId: input.shipmentId,
              currentStatus: { notIn: [TrackingStatus.DELIVERED, TrackingStatus.RETURNED, TrackingStatus.LOST, TrackingStatus.CANCELLED] },
            },
          });

          if (activeTracking) {
            if (!input.replaceActive) {
              return activeTracking;
            }

            // Cancelar rastreamento anterior com auditoria para substituição explícita por troca de transportadora
            await tx.tracking.update({
              where: { id: activeTracking.id },
              data: { currentStatus: TrackingStatus.CANCELLED },
            });

            await tx.trackingStatusHistory.create({
              data: {
                trackingId: activeTracking.id,
                previousStatus: activeTracking.currentStatus,
                newStatus: TrackingStatus.CANCELLED,
                reason: `Rastreamento substituído por novo envio id ${input.shipmentId}`,
                changedById: input.createdById,
              },
            });
          }

          const trackingNumber = input.trackingNumber || `TRK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

          const tracking = await tx.tracking.create({
            data: {
              shipmentId: input.shipmentId,
              carrierId: input.carrierId,
              trackingNumber,
              externalTrackingNumber: input.externalTrackingNumber,
              currentStatus: TrackingStatus.LABEL_CREATED,
              originCountryId: input.originCountryId,
              destinationCountryId: input.destinationCountryId,
              estimatedDeliveryAt: input.estimatedDeliveryAt,
              isInternational: input.isInternational ?? false,
            },
          });

          // Gravar primeiro evento LABEL_CREATED
          const deduplicationKey = crypto.createHash('sha256').update(`${tracking.id}:LABEL_CREATED:${Date.now()}`).digest('hex');

          await tx.trackingEvent.create({
            data: {
              trackingId: tracking.id,
              eventCode: 'LABEL_CREATED',
              status: TrackingStatus.LABEL_CREATED,
              title: 'Etiqueta de Envio Gerada',
              description: 'Rastreamento iniciado no sistema logístico Nusali',
              deduplicationKey,
              source: TrackingEventSource.SYSTEM,
              eventAt: new Date(),
            },
          });

          await tx.trackingStatusHistory.create({
            data: {
              trackingId: tracking.id,
              newStatus: TrackingStatus.LABEL_CREATED,
              reason: 'Criação inicial do rastreamento',
              changedById: input.createdById,
            },
          });

          return tracking;
        },
        { isolationLevel: 'Serializable' as any },
      );
    } catch (error: any) {
      if (
        error?.code === 'P2002' ||
        (error?.message && error.message.includes('tracking_active_shipment_idx'))
      ) {
        const active = await this.prisma.tracking.findFirst({
          where: {
            shipmentId: input.shipmentId,
            currentStatus: { notIn: [TrackingStatus.DELIVERED, TrackingStatus.RETURNED, TrackingStatus.LOST, TrackingStatus.CANCELLED] },
          },
        });
        if (active) return active;
        throw new ConflictException({
          statusCode: 409,
          message: 'Já existe um rastreamento ativo para esta remessa.',
          errorCode: 'TRACKING_ALREADY_ACTIVE',
        });
      }
      throw error;
    }
  }

  /**
   * Consulta pública higienizada por número de rastreamento.
   */
  async findPublicTracking(trackingNumber: string) {
    const tracking = await this.prisma.tracking.findUnique({
      where: { trackingNumber: trackingNumber.trim() },
      include: {
        carrier: true,
        originCountry: true,
        destinationCountry: true,
        events: {
          include: { country: true },
          orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }],
        },
      },
    });

    if (!tracking) {
      throw new NotFoundException(`Rastreamento '${trackingNumber}' não encontrado.`);
    }

    return PublicTrackingMapper.toPublic(tracking);
  }

  /**
   * Consulta do comprador para seus próprios pedidos.
   */
  async findBuyerTracking(userId: string, trackingNumberOrId: string) {
    const tracking = await this.prisma.tracking.findFirst({
      where: {
        OR: [{ id: trackingNumberOrId }, { trackingNumber: trackingNumberOrId }],
        shipment: {
          order: { userId },
        },
      },
      include: {
        carrier: true,
        events: { orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }] },
        checkpoints: { orderBy: { sequence: 'asc' } },
        deliveries: { select: { id: true, status: true, scheduledDate: true, attemptCount: true } },
      },
    });

    if (!tracking) {
      throw new NotFoundException('Rastreamento não encontrado ou acesso não autorizado.');
    }

    return tracking;
  }

  /**
   * Consulta do vendedor para pedidos de suas lojas verificadas.
   */
  async findSellerTracking(userId: string, trackingId: string) {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { userId, status: 'VERIFIED' },
    });

    if (!seller) {
      throw new ForbiddenException('Apenas vendedores com perfil verificado podem consultar rastreamentos operacionais.');
    }

    const tracking = await this.prisma.tracking.findFirst({
      where: {
        id: trackingId,
        shipment: {
          order: { store: { sellerId: seller.id } },
        },
      },
      include: {
        carrier: true,
        shipment: { include: { order: true } },
        events: { orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }] },
        checkpoints: { orderBy: { sequence: 'asc' } },
        deliveries: true,
        exceptions: true,
      },
    });

    if (!tracking) {
      throw new NotFoundException('Rastreamento de remessa não encontrado para suas lojas.');
    }

    return tracking;
  }

  /**
   * Adiciona um evento de rastreamento (Admin / Operacional).
   */
  async findAllBuyerTrackings(userId: string) {
    return this.prisma.tracking.findMany({
      where: {
        shipment: { order: { userId } },
      },
      include: {
        carrier: true,
        events: { orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }], take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBuyerTrackingByOrder(userId: string, orderId: string) {
    const tracking = await this.prisma.tracking.findFirst({
      where: {
        shipment: { orderId, order: { userId } },
      },
      include: {
        carrier: true,
        events: { orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }] },
        checkpoints: { orderBy: { sequence: 'asc' } },
        deliveries: { select: { id: true, status: true, scheduledDate: true, attemptCount: true } },
      },
    });

    if (!tracking) {
      throw new NotFoundException(`Rastreamento não encontrado para o pedido '${orderId}'.`);
    }

    return tracking;
  }

  async findAllSellerTrackings(userId: string) {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { userId, status: 'VERIFIED' },
    });

    if (!seller) {
      throw new ForbiddenException('Apenas vendedores com perfil verificado podem consultar rastreamentos.');
    }

    return this.prisma.tracking.findMany({
      where: {
        shipment: { order: { store: { sellerId: seller.id } } },
      },
      include: {
        carrier: true,
        shipment: { select: { id: true, shipmentCode: true, status: true } },
        events: { orderBy: [{ eventAt: 'desc' }], take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAdminTrackings(filters?: { status?: TrackingStatus; carrierId?: string }) {
    const where: any = {};
    if (filters?.status) where.currentStatus = filters.status;
    if (filters?.carrierId) where.carrierId = filters.carrierId;

    return this.prisma.tracking.findMany({
      where,
      include: {
        carrier: true,
        shipment: { include: { order: true } },
        events: { orderBy: [{ eventAt: 'desc' }], take: 3 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminTrackingById(id: string) {
    const tracking = await this.prisma.tracking.findUnique({
      where: { id },
      include: {
        carrier: true,
        shipment: { include: { order: true } },
        events: { orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }] },
        checkpoints: { orderBy: { sequence: 'asc' } },
        deliveries: { include: { attempts: true, driver: true, vehicle: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        exceptions: true,
      },
    });

    if (!tracking) throw new NotFoundException(`Rastreamento '${id}' não encontrado.`);
    return tracking;
  }

  async overrideStatus(id: string, newStatus: TrackingStatus, reason: string, operatorId?: string) {
    const tracking = await this.findAdminTrackingById(id);
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Motivo de override administrativo de status é obrigatório e deve ter no mínimo 5 caracteres.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tracking.update({
        where: { id },
        data: { currentStatus: newStatus },
      });

      await tx.trackingStatusHistory.create({
        data: {
          trackingId: id,
          previousStatus: tracking.currentStatus,
          newStatus,
          reason: `OVERRIDE ADMIN: ${reason}`,
          changedById: operatorId,
        },
      });

      return updated;
    });
  }

  // Checkpoints
  async addCheckpoint(trackingId: string, input: { sequence: number; type: any; status?: any; locationName: string; city?: string; stateCode?: string; countryId?: string }) {
    await this.findAdminTrackingById(trackingId);

    const existingSeq = await this.prisma.trackingCheckpoint.findFirst({
      where: { trackingId, sequence: input.sequence },
    });
    if (existingSeq) {
      throw new ConflictException(`Sequence '${input.sequence}' já existe para o rastreamento '${trackingId}'.`);
    }

    return this.prisma.trackingCheckpoint.create({
      data: {
        trackingId,
        sequence: input.sequence,
        type: input.type,
        name: input.locationName,
        city: input.city,
        region: input.stateCode,
        countryId: input.countryId,
      },
    });
  }

  async findCheckpoints(trackingId: string) {
    return this.prisma.trackingCheckpoint.findMany({
      where: { trackingId },
      orderBy: { sequence: 'asc' },
    });
  }

  async updateCheckpoint(id: string, input: any) {
    const checkpoint = await this.prisma.trackingCheckpoint.findUnique({ where: { id } });
    if (!checkpoint) throw new NotFoundException(`Checkpoint '${id}' não encontrado.`);
    return this.prisma.trackingCheckpoint.update({ where: { id }, data: input });
  }

  async addEvent(
    trackingId: string,
    eventCode: string,
    status: TrackingStatus,
    title: string,
    description?: string,
    operatorId?: string,
  ) {
    return this.stateMachine.processEvent({
      trackingId,
      eventCode,
      status,
      title,
      description,
      source: TrackingEventSource.OPERATOR,
      eventAt: new Date(),
      changedById: operatorId,
    });
  }
}
