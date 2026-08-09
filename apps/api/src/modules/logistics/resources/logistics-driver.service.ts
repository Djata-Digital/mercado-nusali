import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverStatus } from '@prisma/client';

export interface CreateDriverInput {
  userId: string;
  carrierId: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiresAt: Date;
  phone?: string;
  emergencyPhone?: string;
  status?: DriverStatus;
}

@Injectable()
export class LogisticsDriverService {
  constructor(private readonly prisma: PrismaService) {}

  async createDriver(input: CreateDriverInput) {
    const existingLicense = await this.prisma.logisticsDriver.findUnique({
      where: { licenseNumber: input.licenseNumber },
    });
    if (existingLicense) {
      throw new ConflictException(`CNH '${input.licenseNumber}' já cadastrada para outro motorista.`);
    }

    return this.prisma.logisticsDriver.create({
      data: {
        userId: input.userId,
        carrierId: input.carrierId,
        licenseNumber: input.licenseNumber,
        licenseCategory: input.licenseCategory,
        licenseExpiresAt: input.licenseExpiresAt,
        phone: input.phone || 'N/A',
        emergencyPhone: input.emergencyPhone,
        status: input.status || DriverStatus.ACTIVE,
      },
    });
  }

  async findAll(carrierId?: string, status?: DriverStatus) {
    const where: any = {};
    if (carrierId) where.carrierId = carrierId;
    if (status) where.status = status;

    return this.prisma.logisticsDriver.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, carrier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const driver = await this.prisma.logisticsDriver.findUnique({
      where: { id },
      include: { user: true, carrier: true, assignments: true, deliveries: { take: 5 } },
    });
    if (!driver) throw new NotFoundException(`Motorista '${id}' não encontrado.`);
    return driver;
  }

  async updateDriver(id: string, input: Partial<CreateDriverInput>) {
    await this.findOne(id);
    return this.prisma.logisticsDriver.update({
      where: { id },
      data: input,
    });
  }
}
