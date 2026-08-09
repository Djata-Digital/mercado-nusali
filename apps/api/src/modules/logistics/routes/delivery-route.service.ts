import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryRouteStatus, CheckpointStatus, DriverStatus, VehicleStatus } from '@prisma/client';
import * as crypto from 'crypto';

export interface CreateDeliveryRouteInput {
  carrierId: string;
  warehouseId: string;
  driverId?: string;
  vehicleId?: string;
  date: Date;
  deliveryIds: string[];
}

@Injectable()
export class RouteOptimizationProvider {
  /**
   * Ordena paradas de rota de forma determinística por Código Postal (CEP) ou Endereço.
   */
  optimizeStops(deliveries: { id: string; addressSnapshotJson?: any }[]): { id: string; sequence: number }[] {
    const sorted = [...deliveries].sort((a, b) => {
      const postalA = a.addressSnapshotJson?.postalCode || '';
      const postalB = b.addressSnapshotJson?.postalCode || '';
      return postalA.localeCompare(postalB);
    });

    return sorted.map((d, index) => ({ id: d.id, sequence: index + 1 }));
  }
}

@Injectable()
export class DeliveryRouteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeOptimizer: RouteOptimizationProvider,
  ) {}

  /**
   * Cria uma rota de entregas com ordenação determinística por CEP, cálculo de volume real m3 e validações atômicas de recursos.
   */
  async createRoute(input: CreateDeliveryRouteInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Validar motorista e verificar se já possui outra rota ativa
        if (input.driverId) {
          const driver = await tx.logisticsDriver.findUnique({
            where: { id: input.driverId },
          });

          if (!driver || driver.status !== DriverStatus.ACTIVE) {
            throw new BadRequestException('Motorista inativo ou não encontrado.');
          }

          if (driver.licenseExpiresAt < new Date()) {
            throw new ForbiddenException(`A CNH do motorista ${driver.id} expirou.`);
          }

          if (driver.carrierId !== input.carrierId) {
            throw new BadRequestException('O motorista deve pertencer à mesma transportadora da rota.');
          }

          const activeDriverRoute = await tx.deliveryRoute.findFirst({
            where: {
              driverId: input.driverId,
              status: { in: [DeliveryRouteStatus.PLANNED, DeliveryRouteStatus.ASSIGNED, DeliveryRouteStatus.IN_PROGRESS] },
            },
          });
          if (activeDriverRoute) {
            throw new ConflictException({
              code: 'DRIVER_ALREADY_ASSIGNED',
              message: `O motorista '${input.driverId}' já está atribuído à rota ativa '${activeDriverRoute.id}'.`,
            });
          }
        }

        // Validar veículo e verificar se já possui outra rota ativa
        let vehicle: any = null;
        if (input.vehicleId) {
          vehicle = await tx.logisticsVehicle.findUnique({
            where: { id: input.vehicleId },
          });

          if (!vehicle || vehicle.status === VehicleStatus.INACTIVE || vehicle.status === VehicleStatus.MAINTENANCE) {
            throw new BadRequestException('Veículo indisponível ou em manutenção.');
          }

          if (vehicle.carrierId !== input.carrierId) {
            throw new BadRequestException('O veículo deve pertencer à mesma transportadora da rota.');
          }

          const activeVehicleRoute = await tx.deliveryRoute.findFirst({
            where: {
              vehicleId: input.vehicleId,
              status: { in: [DeliveryRouteStatus.PLANNED, DeliveryRouteStatus.ASSIGNED, DeliveryRouteStatus.IN_PROGRESS] },
            },
          });
          if (activeVehicleRoute) {
            throw new ConflictException({
              code: 'VEHICLE_ALREADY_ASSIGNED',
              message: `O veículo '${input.vehicleId}' já está atribuído à rota ativa '${activeVehicleRoute.id}'.`,
            });
          }
        }

        // Buscar entregas para otimização determinística de rota e cálculo de peso e volume m3 real
        const deliveries = await tx.delivery.findMany({
          where: { id: { in: input.deliveryIds } },
          include: { shipment: { include: { packages: true } } },
        });

        if (deliveries.length !== input.deliveryIds.length) {
          throw new NotFoundException('Uma ou mais entregas informadas não foram encontradas.');
        }

        for (const d of deliveries) {
          if (d.carrierId !== input.carrierId) {
            throw new BadRequestException(`A entrega ${d.id} pertence a outra transportadora.`);
          }
        }

        // Calcular peso (kg) e volume (m³) reais das encomendas
        let totalWeightKg = 0;
        let totalVolumeM3 = 0;

        for (const d of deliveries) {
          for (const pkg of d.shipment.packages) {
            totalWeightKg += Number(pkg.weight || 0);
            const dims = pkg.dimensionsJson as any;
            const l = Number(dims?.length || 0);
            const w = Number(dims?.width || 0);
            const h = Number(dims?.height || 0);
            if (l > 0 && w > 0 && h > 0) {
              totalVolumeM3 += (l * w * h) / 1000000; // cm³ para m³
            }
          }
        }

        if (vehicle) {
          if (vehicle.maxWeight && totalWeightKg > Number(vehicle.maxWeight)) {
            throw new BadRequestException(
              `O peso total das encomendas (${totalWeightKg}kg) excede a capacidade máxima do veículo (${vehicle.maxWeight}kg).`,
            );
          }

          if (vehicle.maxVolume && totalVolumeM3 > Number(vehicle.maxVolume)) {
            throw new BadRequestException(
              `O volume total das encomendas (${totalVolumeM3.toFixed(3)}m³) excede o volume máximo do veículo (${vehicle.maxVolume}m³).`,
            );
          }
        }

        const optimizedStops = this.routeOptimizer.optimizeStops(deliveries);
        const routeNumber = `ROT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const initialStatus = input.driverId && input.vehicleId ? DeliveryRouteStatus.ASSIGNED : DeliveryRouteStatus.PLANNED;

        const route = await tx.deliveryRoute.create({
          data: {
            routeNumber,
            carrierId: input.carrierId,
            warehouseId: input.warehouseId,
            driverId: input.driverId,
            vehicleId: input.vehicleId,
            date: input.date,
            status: initialStatus,
            totalStops: deliveries.length,
          },
        });

        for (const stop of optimizedStops) {
          await tx.deliveryRouteStop.create({
            data: {
              routeId: route.id,
              deliveryId: stop.id,
              sequence: stop.sequence,
              status: CheckpointStatus.PLANNED,
            },
          });
        }

        // Registrar atribuição de motorista/veículo se fornecidos
        if (input.driverId && input.vehicleId) {
          await tx.driverAssignment.create({
            data: {
              driverId: input.driverId,
              vehicleId: input.vehicleId,
              status: 'ASSIGNED',
              assignedAt: new Date(),
              notes: `Atribuição automática para rota ${route.routeNumber}`,
            },
          });

          await tx.logisticsVehicle.update({
            where: { id: input.vehicleId },
            data: { status: VehicleStatus.ASSIGNED },
          });
        }

        await tx.deliveryRouteHistory.create({
          data: {
            routeId: route.id,
            newStatus: initialStatus,
            notes: `Rota criada com ${deliveries.length} entregas (Peso: ${totalWeightKg}kg, Volume: ${totalVolumeM3.toFixed(3)}m³)`,
          },
        });

        return route;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const target = JSON.stringify(error?.meta || {});
        if (target.includes('driver') || target.includes('DRIVER')) {
          throw new ConflictException({
            code: 'DRIVER_ALREADY_ASSIGNED',
            message: 'O motorista especificado já está atribuído a uma rota ativa.',
          });
        }
        if (target.includes('vehicle') || target.includes('VEHICLE')) {
          throw new ConflictException({
            code: 'VEHICLE_ALREADY_ASSIGNED',
            message: 'O veículo especificado já está atribuído a uma rota ativa.',
          });
        }
        throw new ConflictException({
          code: 'ROUTE_RESOURCE_CONFLICT',
          message: 'Concorrência: recurso de rota ou entrega já alocado.',
        });
      }
      throw error;
    }
  }

  async findAll(filters?: { carrierId?: string; status?: DeliveryRouteStatus; driverId?: string }) {
    const where: any = {};
    if (filters?.carrierId) where.carrierId = filters.carrierId;
    if (filters?.status) where.status = filters.status;
    if (filters?.driverId) where.driverId = filters.driverId;

    return this.prisma.deliveryRoute.findMany({
      where,
      include: { carrier: true, driver: { include: { user: true } }, vehicle: true },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const route = await this.prisma.deliveryRoute.findUnique({
      where: { id },
      include: {
        carrier: true,
        warehouse: true,
        driver: { include: { user: true } },
        vehicle: true,
        stops: {
          include: {
            delivery: {
              include: { shipment: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
        history: true,
      },
    });

    if (!route) {
      throw new NotFoundException(`Rota id ${id} não encontrada.`);
    }

    return route;
  }

  async addStop(routeId: string, deliveryId: string, sequenceOrder?: number) {
    const route = await this.findOne(routeId);

    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException(`Entrega '${deliveryId}' não encontrada.`);

    if (delivery.carrierId !== route.carrierId) {
      throw new BadRequestException('A entrega deve pertencer à mesma transportadora da rota.');
    }

    const nextSeq = sequenceOrder || route.stops.length + 1;

    try {
      return await this.prisma.deliveryRouteStop.create({
        data: {
          routeId,
          deliveryId,
          sequence: nextSeq,
          status: CheckpointStatus.PLANNED,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.message?.includes('delivery_route_stop_active_delivery_idx')) {
        throw new ConflictException({
          code: 'ROUTE_RESOURCE_CONFLICT',
          message: `A entrega '${deliveryId}' já está associada a outra rota ativa.`,
        });
      }
      throw error;
    }
  }

  async updateStopStatus(stopId: string, status: CheckpointStatus) {
    const stop = await this.prisma.deliveryRouteStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundException(`Parada de rota '${stopId}' não encontrada.`);

    return this.prisma.deliveryRouteStop.update({
      where: { id: stopId },
      data: {
        status,
        arrivedAt: status === CheckpointStatus.ARRIVED ? new Date() : stop.arrivedAt,
        completedAt: status === CheckpointStatus.DEPARTED ? new Date() : stop.completedAt,
      },
    });
  }

  /**
   * Atualiza o status da rota via Máquina de Estados explícita:
   * PLANNED -> ASSIGNED -> IN_PROGRESS -> COMPLETED (e CANCELLED a partir de qualquer estado não terminal).
   */
  async updateRouteStatus(id: string, newStatus: DeliveryRouteStatus, operatorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const route = await tx.deliveryRoute.findUnique({ where: { id } });
      if (!route) {
        throw new NotFoundException(`Rota id ${id} não encontrada.`);
      }

      // Validação da Máquina de Estados de DeliveryRoute
      const currentStatus = route.status;

      if (currentStatus === newStatus) {
        return route; // Idempotente
      }

      const validTransitions: Record<DeliveryRouteStatus, DeliveryRouteStatus[]> = {
        PLANNED: [DeliveryRouteStatus.ASSIGNED, DeliveryRouteStatus.IN_PROGRESS, DeliveryRouteStatus.CANCELLED],
        ASSIGNED: [DeliveryRouteStatus.IN_PROGRESS, DeliveryRouteStatus.CANCELLED],
        IN_PROGRESS: [DeliveryRouteStatus.COMPLETED, DeliveryRouteStatus.CANCELLED],
        COMPLETED: [],
        CANCELLED: [],
      };

      const allowedNext = validTransitions[currentStatus] || [];
      if (!allowedNext.includes(newStatus)) {
        throw new BadRequestException(
          `Transição de status de rota inválida de ${currentStatus} para ${newStatus}.`,
        );
      }

      const updateResult = await tx.deliveryRoute.updateMany({
        where: { id, status: currentStatus },
        data: {
          status: newStatus,
          startedAt: newStatus === DeliveryRouteStatus.IN_PROGRESS ? new Date() : route.startedAt,
          completedAt: newStatus === DeliveryRouteStatus.COMPLETED ? new Date() : route.completedAt,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Concorrência detectada: o status da rota foi alterado por outro operador.');
      }

      // Liberação automática de recursos (Veículo e Motorista) ao CONCLUIR ou CANCELAR a rota
      if (newStatus === DeliveryRouteStatus.COMPLETED || newStatus === DeliveryRouteStatus.CANCELLED) {
        if (route.vehicleId) {
          await tx.logisticsVehicle.update({
            where: { id: route.vehicleId },
            data: { status: VehicleStatus.AVAILABLE },
          });
        }
        if (route.driverId && route.vehicleId) {
          await tx.driverAssignment.updateMany({
            where: { driverId: route.driverId, vehicleId: route.vehicleId, status: 'ASSIGNED' },
            data: { status: 'RELEASED', releasedAt: new Date() },
          });
        }
      }

      const validOperatorId = operatorId && operatorId !== 'anonymous' ? operatorId : null;

      await tx.deliveryRouteHistory.create({
        data: {
          routeId: id,
          previousStatus: currentStatus,
          newStatus: newStatus,
          changedById: validOperatorId,
        },
      });

      return tx.deliveryRoute.findUnique({ where: { id } });
    });
  }
}
