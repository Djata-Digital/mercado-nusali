import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HubZoneType, HubLocationStatus } from '@prisma/client';

export interface AllocationRequest {
  warehouseId: string;
  preferredZoneType?: HubZoneType;
  quantityNeeded: number;
  totalWeightKg?: number;
  totalVolumeM3?: number;
}

@Injectable()
export class LocationAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automagically selects an optimal location inside a HUB using configurable criteria:
   * 1. Zone type (STORAGE by default)
   * 2. Highest Zone Priority
   * 3. Location Status === AVAILABLE
   * 4. Sufficient free capacity (capacity - usedCapacity >= quantityNeeded)
   * 5. Sufficient weight margin (maxWeight - currentWeight >= totalWeightKg)
   * 6. Sufficient volume margin (maxVolume - currentVolume >= totalVolumeM3)
   */
  async findOptimalLocation(req: AllocationRequest) {
    const targetZoneType = req.preferredZoneType || HubZoneType.STORAGE;
    const qty = req.quantityNeeded || 1;
    const weight = req.totalWeightKg || 0;
    const volume = req.totalVolumeM3 || 0;

    // Find zones matching the target type in the hub ordered by priority descending
    const zones = await this.prisma.hubZone.findMany({
      where: {
        warehouseId: req.warehouseId,
        type: targetZoneType,
      },
      orderBy: { priority: 'asc' },
    });

    if (zones.length === 0) {
      // Fallback: search any STORAGE zone or any zone in the hub
      const fallbackZones = await this.prisma.hubZone.findMany({
        where: { warehouseId: req.warehouseId },
        orderBy: { priority: 'asc' },
      });
      if (fallbackZones.length === 0) {
        throw new NotFoundException(`Nenhuma zona configurada no HUB ${req.warehouseId}`);
      }
      zones.push(...fallbackZones);
    }

    const zoneIds = zones.map((z) => z.id);

    // Find candidates
    const candidateLocations = await this.prisma.hubLocation.findMany({
      where: {
        warehouseId: req.warehouseId,
        zoneId: { in: zoneIds },
        status: { in: [HubLocationStatus.AVAILABLE, HubLocationStatus.RESERVED] },
      },
      orderBy: [
        { usedCapacity: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    for (const loc of candidateLocations) {
      const freeCap = loc.capacity - loc.usedCapacity;
      const freeWeight = Number(loc.maxWeight) - Number(loc.currentWeight);
      const freeVol = Number(loc.maxVolume) - Number(loc.currentVolume);

      if (freeCap >= qty && freeWeight >= weight && freeVol >= volume) {
        return loc;
      }
    }

    throw new BadRequestException(
      `Sem capacidade física disponível no HUB ${req.warehouseId} para alocar ${qty} itens (Peso: ${weight}kg, Vol: ${volume}m³).`,
    );
  }

  /**
   * Locks and allocates items into a specific location. Updates usedCapacity, weight, and volume.
   */
  async allocateToLocation(
    locationId: string,
    quantity: number,
    weightKg = 0,
    volumeM3 = 0,
    txPrisma?: any,
  ) {
    const client = txPrisma || this.prisma;

    const loc = await client.hubLocation.findUnique({ where: { id: locationId } });
    if (!loc) {
      throw new NotFoundException(`Posição ${locationId} não encontrada.`);
    }

    const newUsedCap = loc.usedCapacity + quantity;
    const newWeight = Number(loc.currentWeight) + weightKg;
    const newVolume = Number(loc.currentVolume) + volumeM3;

    if (newUsedCap > loc.capacity) {
      throw new BadRequestException(`Posição ${loc.code} excederia a capacidade máxima (${loc.capacity}).`);
    }

    const isFull = newUsedCap >= loc.capacity;
    const newStatus = isFull ? HubLocationStatus.OCCUPIED : HubLocationStatus.AVAILABLE;

    const updated = await client.hubLocation.update({
      where: { id: locationId },
      data: {
        usedCapacity: newUsedCap,
        currentWeight: newWeight,
        currentVolume: newVolume,
        status: newStatus,
      },
    });

    // Update zone used capacity
    await client.hubZone.update({
      where: { id: loc.zoneId },
      data: { usedCapacity: { increment: quantity } },
    });

    // Update warehouse used capacity
    await client.warehouse.update({
      where: { id: loc.warehouseId },
      data: {
        usedCapacity: { increment: quantity },
        usedWeight: { increment: weightKg },
        usedVolume: { increment: volumeM3 },
      },
    });

    return updated;
  }

  /**
   * Deallocates items from a location.
   */
  async deallocateFromLocation(
    locationId: string,
    quantity: number,
    weightKg = 0,
    volumeM3 = 0,
    txPrisma?: any,
  ) {
    const client = txPrisma || this.prisma;

    const loc = await client.hubLocation.findUnique({ where: { id: locationId } });
    if (!loc) {
      throw new NotFoundException(`Posição ${locationId} não encontrada.`);
    }

    const newUsedCap = Math.max(0, loc.usedCapacity - quantity);
    const newWeight = Math.max(0, Number(loc.currentWeight) - weightKg);
    const newVolume = Math.max(0, Number(loc.currentVolume) - volumeM3);

    const updated = await client.hubLocation.update({
      where: { id: locationId },
      data: {
        usedCapacity: newUsedCap,
        currentWeight: newWeight,
        currentVolume: newVolume,
        status: HubLocationStatus.AVAILABLE,
      },
    });

    await client.hubZone.update({
      where: { id: loc.zoneId },
      data: { usedCapacity: { decrement: Math.min(quantity, loc.usedCapacity) } },
    });

    await client.warehouse.update({
      where: { id: loc.warehouseId },
      data: {
        usedCapacity: { decrement: Math.min(quantity, loc.usedCapacity) },
        usedWeight: { decrement: Math.min(weightKg, Number(loc.currentWeight)) },
        usedVolume: { decrement: Math.min(volumeM3, Number(loc.currentVolume)) },
      },
    });

    return updated;
  }
}
