import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateHubDto, UpdateHubDto } from '../dto/hub.dto';
import { CreateZoneDto, CreateStructureDto } from '../dto/zone.dto';
import { CreateLocationDto } from '../dto/location.dto';
import { WarehouseType, WarehouseStatus, HubLocationStatus } from '@prisma/client';

@Injectable()
export class HubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createHub(dto: CreateHubDto, userId: string) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Já existe um HUB/Armazém com o código ${dto.code}`);
    }

    const hub = await this.prisma.warehouse.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: WarehouseType.NUSALI_HUB,
        status: WarehouseStatus.ACTIVE,
        countryId: dto.countryId,
        city: dto.city,
        addressLine1: dto.addressLine1,
        timezone: dto.timezone || 'UTC',
        primaryCurrencyId: dto.primaryCurrencyId,
        languagesJson: dto.languages || ['pt'],
        operatingHoursJson: dto.operatingHours || {},
        capacity: dto.capacity || 10000,
        usedCapacity: 0,
        maxWeight: dto.maxWeight || 100000,
        usedWeight: 0,
        maxVolume: dto.maxVolume || 5000,
        usedVolume: 0,
        managerId: dto.managerId || userId,
      },
    });

    this.eventEmitter.emit('hub.created', { hubId: hub.id, code: hub.code, createdBy: userId });
    return hub;
  }

  async updateHub(hubId: string, dto: UpdateHubDto, userId: string) {
    const hub = await this.prisma.warehouse.findUnique({ where: { id: hubId } });
    if (!hub) {
      throw new NotFoundException(`HUB ${hubId} não encontrado.`);
    }

    const updated = await this.prisma.warehouse.update({
      where: { id: hubId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.status && { status: dto.status }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.maxWeight !== undefined && { maxWeight: dto.maxWeight }),
        ...(dto.maxVolume !== undefined && { maxVolume: dto.maxVolume }),
        ...(dto.managerId && { managerId: dto.managerId }),
      },
    });

    this.eventEmitter.emit('hub.updated', { hubId: updated.id, changes: dto, updatedBy: userId });
    return updated;
  }

  async getHubMetrics(hubId: string) {
    const hub = await this.prisma.warehouse.findUnique({
      where: { id: hubId },
      include: {
        zones: true,
        locations: true,
      },
    });
    if (!hub) {
      throw new NotFoundException(`HUB ${hubId} não encontrado.`);
    }

    const totalLocations = hub.locations.length;
    const occupiedLocations = hub.locations.filter((l) => l.status === HubLocationStatus.OCCUPIED).length;
    const availableLocations = hub.locations.filter((l) => l.status === HubLocationStatus.AVAILABLE).length;

    let usedWeightNum = Number(hub.usedWeight);
    let maxWeightNum = Number(hub.maxWeight);
    let usedVolumeNum = Number(hub.usedVolume);
    let maxVolumeNum = Number(hub.maxVolume);

    // Sum from locations if warehouse fields are 0
    if (usedWeightNum === 0 && hub.locations.length > 0) {
      usedWeightNum = hub.locations.reduce((acc, loc) => acc + Number(loc.currentWeight), 0);
    }
    if (usedVolumeNum === 0 && hub.locations.length > 0) {
      usedVolumeNum = hub.locations.reduce((acc, loc) => acc + Number(loc.currentVolume), 0);
    }

    const occupancyRatePercent = hub.capacity > 0 ? (hub.usedCapacity / hub.capacity) * 100 : 0;
    const weightOccupancyPercent = maxWeightNum > 0 ? (usedWeightNum / maxWeightNum) * 100 : 0;
    const volumeOccupancyPercent = maxVolumeNum > 0 ? (usedVolumeNum / maxVolumeNum) * 100 : 0;

    return {
      hubId: hub.id,
      code: hub.code,
      name: hub.name,
      status: hub.status,
      capacity: hub.capacity,
      usedCapacity: hub.usedCapacity,
      freeCapacity: Math.max(0, hub.capacity - hub.usedCapacity),
      occupancyRatePercent: Number(occupancyRatePercent.toFixed(2)),
      maxWeightKg: maxWeightNum,
      usedWeightKg: usedWeightNum,
      freeWeightKg: Math.max(0, maxWeightNum - usedWeightNum),
      weightOccupancyPercent: Number(weightOccupancyPercent.toFixed(2)),
      maxVolumeM3: maxVolumeNum,
      usedVolumeM3: usedVolumeNum,
      freeVolumeM3: Math.max(0, maxVolumeNum - usedVolumeNum),
      volumeOccupancyPercent: Number(volumeOccupancyPercent.toFixed(2)),
      locationsSummary: {
        total: totalLocations,
        available: availableLocations,
        occupied: occupiedLocations,
      },
    };
  }

  async getHubById(hubId: string) {
    const hub = await this.prisma.warehouse.findUnique({
      where: { id: hubId },
      include: {
        country: true,
        primaryCurrency: true,
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        zones: {
          include: {
            aisles: {
              include: {
                racks: {
                  include: {
                    shelves: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!hub) {
      throw new NotFoundException(`HUB ${hubId} não encontrado.`);
    }

    const metrics = await this.getHubMetrics(hubId);
    return {
      ...hub,
      metrics,
    };
  }

  async listHubs(page = 1, limit = 20, countryId?: string, status?: WarehouseStatus) {
    const skip = (page - 1) * limit;
    const where = {
      type: WarehouseType.NUSALI_HUB,
      ...(countryId && { countryId }),
      ...(status && { status }),
    };

    const [hubs, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        include: {
          country: true,
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { zones: true, locations: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return {
      data: hubs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createZone(dto: CreateZoneDto) {
    const hub = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!hub) {
      throw new NotFoundException(`HUB ${dto.warehouseId} não encontrado.`);
    }

    const existingCode = await this.prisma.hubZone.findUnique({
      where: {
        warehouseId_code: {
          warehouseId: dto.warehouseId,
          code: dto.code,
        },
      },
    });
    if (existingCode) {
      throw new ConflictException(`Já existe uma zona com o código ${dto.code} neste HUB.`);
    }

    return this.prisma.hubZone.create({
      data: {
        warehouseId: dto.warehouseId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        capacity: dto.capacity || 1000,
        priority: dto.priority || 1,
        locationNotes: dto.locationNotes,
      },
    });
  }

  async createAisle(zoneId: string, dto: CreateStructureDto) {
    const zone = await this.prisma.hubZone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`Zona ${zoneId} não encontrada.`);
    }

    return this.prisma.hubAisle.create({
      data: {
        zoneId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async createRack(aisleId: string, dto: CreateStructureDto) {
    const aisle = await this.prisma.hubAisle.findUnique({ where: { id: aisleId } });
    if (!aisle) {
      throw new NotFoundException(`Corredor ${aisleId} não encontrado.`);
    }

    return this.prisma.hubRack.create({
      data: {
        aisleId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async createShelf(rackId: string, dto: CreateStructureDto) {
    const rack = await this.prisma.hubRack.findUnique({ where: { id: rackId } });
    if (!rack) {
      throw new NotFoundException(`Estante ${rackId} não encontrada.`);
    }

    return this.prisma.hubShelf.create({
      data: {
        rackId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async createLocation(dto: CreateLocationDto) {
    const existing = await this.prisma.hubLocation.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Já existe uma posição com o código ${dto.code}`);
    }

    const location = await this.prisma.hubLocation.create({
      data: {
        warehouseId: dto.warehouseId,
        zoneId: dto.zoneId,
        shelfId: dto.shelfId,
        code: dto.code,
        status: dto.status || HubLocationStatus.AVAILABLE,
        capacity: dto.capacity || 100,
        maxWeight: dto.maxWeight || 1000,
        maxVolume: dto.maxVolume || 10,
      },
    });

    // Recalculate capacity count on zone and warehouse
    await this.prisma.hubZone.update({
      where: { id: dto.zoneId },
      data: { capacity: { increment: 1 } },
    });

    await this.prisma.warehouse.update({
      where: { id: dto.warehouseId },
      data: { capacity: { increment: 1 } },
    });

    return location;
  }
}
