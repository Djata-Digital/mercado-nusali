import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VehicleStatus, VehicleType } from '@prisma/client';

export interface CreateVehicleInput {
  carrierId: string;
  plate: string;
  type: VehicleType;
  brand?: string;
  model?: string;
  year?: number;
  maxWeightKg: number;
  maxVolumeM3: number;
  status?: VehicleStatus;
}

@Injectable()
export class LogisticsVehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async createVehicle(input: CreateVehicleInput) {
    const existingPlate = await this.prisma.logisticsVehicle.findUnique({
      where: { plate: input.plate.toUpperCase() },
    });
    if (existingPlate) {
      throw new ConflictException(`Veículo com placa '${input.plate}' já cadastrado.`);
    }

    return this.prisma.logisticsVehicle.create({
      data: {
        carrierId: input.carrierId,
        plate: input.plate.toUpperCase(),
        type: input.type,
        brand: input.brand || 'N/A',
        model: input.model || 'N/A',
        year: input.year || new Date().getFullYear(),
        maxWeight: input.maxWeightKg,
        maxVolume: input.maxVolumeM3,
        status: input.status || VehicleStatus.AVAILABLE,
      },
    });
  }

  async findAll(carrierId?: string, status?: VehicleStatus, type?: VehicleType) {
    const where: any = {};
    if (carrierId) where.carrierId = carrierId;
    if (status) where.status = status;
    if (type) where.type = type;

    return this.prisma.logisticsVehicle.findMany({
      where,
      include: { carrier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.logisticsVehicle.findUnique({
      where: { id },
      include: { carrier: true, assignments: true, deliveries: { take: 5 } },
    });
    if (!vehicle) throw new NotFoundException(`Veículo '${id}' não encontrado.`);
    return vehicle;
  }

  async updateVehicle(id: string, input: Partial<CreateVehicleInput>) {
    await this.findOne(id);
    return this.prisma.logisticsVehicle.update({
      where: { id },
      data: {
        ...(input.plate && { plate: input.plate.toUpperCase() }),
        ...(input.type && { type: input.type }),
        ...(input.brand !== undefined && { brand: input.brand }),
        ...(input.model !== undefined && { model: input.model }),
        ...(input.year !== undefined && { year: input.year }),
        ...(input.maxWeightKg !== undefined && { maxWeightKg: input.maxWeightKg }),
        ...(input.maxVolumeM3 !== undefined && { maxVolumeM3: input.maxVolumeM3 }),
        ...(input.status && { status: input.status }),
      },
    });
  }
}
