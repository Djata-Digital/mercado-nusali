import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretsEncryptionService } from '../security/secrets-encryption.service';
import { CarrierStatus, CarrierType, CarrierEnvironment, TransportMode } from '@prisma/client';

export interface CreateCarrierInput {
  code: string;
  name: string;
  legalName?: string;
  taxId?: string;
  countryId?: string;
  type?: CarrierType;
  website?: string;
  supportEmail?: string;
  supportPhone?: string;
  trackingUrlTemplate?: string;
  supportsPickup?: boolean;
  supportsDelivery?: boolean;
  supportsInternational?: boolean;
  supportsReturns?: boolean;
  metadataJson?: Record<string, any>;
}

export interface CreateCarrierAccountInput {
  carrierId: string;
  countryId?: string;
  environment?: CarrierEnvironment;
  credentials: Record<string, any>;
  webhookSecret?: string;
  metadataJson?: Record<string, any>;
}

@Injectable()
export class CarrierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretsEncryption: SecretsEncryptionService,
  ) {}

  async createCarrier(input: CreateCarrierInput) {
    const existing = await this.prisma.carrier.findUnique({
      where: { code: input.code },
    });

    if (existing) {
      throw new ConflictException(`Transportadora com código '${input.code}' já existe.`);
    }

    return this.prisma.carrier.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        legalName: input.legalName,
        taxId: input.taxId,
        countryId: input.countryId,
        type: input.type || CarrierType.LOCAL_PARTNER,
        status: CarrierStatus.ACTIVE,
        website: input.website,
        supportEmail: input.supportEmail,
        supportPhone: input.supportPhone,
        trackingUrlTemplate: input.trackingUrlTemplate,
        supportsPickup: input.supportsPickup ?? true,
        supportsDelivery: input.supportsDelivery ?? true,
        supportsInternational: input.supportsInternational ?? false,
        supportsReturns: input.supportsReturns ?? true,
        metadataJson: input.metadataJson as any,
      },
    });
  }

  async findAll(status?: CarrierStatus, type?: CarrierType) {
    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (type) where.type = type;

    return this.prisma.carrier.findMany({
      where,
      include: {
        country: true,
        services: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findPublicCarriers() {
    return this.prisma.carrier.findMany({
      where: {
        status: CarrierStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        website: true,
        supportsPickup: true,
        supportsDelivery: true,
        supportsInternational: true,
        services: {
          where: { status: CarrierStatus.ACTIVE },
          select: {
            serviceCode: true,
            name: true,
            description: true,
            mode: true,
            estimatedMinDays: true,
            estimatedMaxDays: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const carrier = await this.prisma.carrier.findUnique({
      where: { id },
      include: {
        country: true,
        services: { include: { zones: true } },
        accounts: {
          select: {
            id: true,
            carrierId: true,
            countryId: true,
            environment: true,
            status: true,
            metadataJson: true,
            createdAt: true,
            updatedAt: true,
            // NUNCA expor credentialsEncryptedJson ou webhookSecretEncrypted
          },
        },
      },
    });

    if (!carrier || carrier.deletedAt) {
      throw new NotFoundException(`Transportadora com id '${id}' não encontrada.`);
    }

    return carrier;
  }

  async updateStatus(id: string, status: CarrierStatus) {
    await this.findOne(id);

    return this.prisma.carrier.update({
      where: { id },
      data: { status },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);

    return this.prisma.carrier.update({
      where: { id },
      data: {
        status: CarrierStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });
  }

  async updateCarrier(id: string, input: Partial<CreateCarrierInput>) {
    await this.findOne(id);
    return this.prisma.carrier.update({
      where: { id },
      data: {
        ...(input.code && { code: input.code.toUpperCase() }),
        ...(input.name && { name: input.name }),
        ...(input.legalName !== undefined && { legalName: input.legalName }),
        ...(input.taxId !== undefined && { taxId: input.taxId }),
        ...(input.countryId !== undefined && { countryId: input.countryId }),
        ...(input.type && { type: input.type }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.supportEmail !== undefined && { supportEmail: input.supportEmail }),
        ...(input.supportPhone !== undefined && { supportPhone: input.supportPhone }),
        ...(input.trackingUrlTemplate !== undefined && { trackingUrlTemplate: input.trackingUrlTemplate }),
        ...(input.supportsPickup !== undefined && { supportsPickup: input.supportsPickup }),
        ...(input.supportsDelivery !== undefined && { supportsDelivery: input.supportsDelivery }),
        ...(input.supportsInternational !== undefined && { supportsInternational: input.supportsInternational }),
        ...(input.supportsReturns !== undefined && { supportsReturns: input.supportsReturns }),
        ...(input.metadataJson && { metadataJson: input.metadataJson as any }),
      },
    });
  }

  async createAccount(input: CreateCarrierAccountInput) {
    await this.findOne(input.carrierId);

    const encryptedCredentials = this.secretsEncryption.encrypt(input.credentials);
    const encryptedSecret = input.webhookSecret
      ? JSON.stringify(this.secretsEncryption.encrypt(input.webhookSecret))
      : null;

    const account = await this.prisma.carrierAccount.create({
      data: {
        carrierId: input.carrierId,
        countryId: input.countryId,
        environment: input.environment || CarrierEnvironment.SANDBOX,
        status: CarrierStatus.ACTIVE,
        credentialsEncryptedJson: encryptedCredentials as any,
        webhookSecretEncrypted: encryptedSecret,
        metadataJson: input.metadataJson as any,
      },
    });

    const { credentialsEncryptedJson, webhookSecretEncrypted, ...safeAccount } = account as any;
    return safeAccount;
  }

  async findAccounts(carrierId: string) {
    await this.findOne(carrierId);
    const accounts = await this.prisma.carrierAccount.findMany({
      where: { carrierId },
      include: { country: true },
    });
    return accounts.map(({ credentialsEncryptedJson, webhookSecretEncrypted, ...safe }) => safe);
  }

  async updateAccount(id: string, input: Partial<CreateCarrierAccountInput>) {
    const existing = await this.prisma.carrierAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Conta de transportadora '${id}' não encontrada.`);

    const data: any = {};
    if (input.countryId !== undefined) data.countryId = input.countryId;
    if (input.environment) data.environment = input.environment;
    if (input.credentials) data.credentialsEncryptedJson = this.secretsEncryption.encrypt(input.credentials);
    if (input.webhookSecret) data.webhookSecretEncrypted = JSON.stringify(this.secretsEncryption.encrypt(input.webhookSecret));
    if (input.metadataJson) data.metadataJson = input.metadataJson;

    const updated = await this.prisma.carrierAccount.update({ where: { id }, data });
    const { credentialsEncryptedJson, webhookSecretEncrypted, ...safe } = updated as any;
    return safe;
  }

  async deleteAccount(id: string) {
    const existing = await this.prisma.carrierAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Conta de transportadora '${id}' não encontrada.`);
    return this.prisma.carrierAccount.delete({ where: { id } });
  }

  // Carrier Services
  async createService(carrierId: string, input: { serviceCode: string; name: string; description?: string; mode?: TransportMode; isInternational?: boolean; estimatedMinDays?: number; estimatedMaxDays?: number }) {
    await this.findOne(carrierId);
    return this.prisma.carrierService.create({
      data: {
        carrierId,
        serviceCode: input.serviceCode.toUpperCase(),
        name: input.name,
        description: input.description,
        mode: input.mode || TransportMode.ROAD,
        isInternational: input.isInternational ?? false,
        estimatedMinDays: input.estimatedMinDays ?? 1,
        estimatedMaxDays: input.estimatedMaxDays ?? 5,
        status: CarrierStatus.ACTIVE,
      },
    });
  }

  async findServices(carrierId: string) {
    await this.findOne(carrierId);
    return this.prisma.carrierService.findMany({
      where: { carrierId },
      include: { zones: true },
    });
  }

  async updateService(id: string, input: any) {
    const existing = await this.prisma.carrierService.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Serviço de transportadora '${id}' não encontrado.`);
    return this.prisma.carrierService.update({ where: { id }, data: input });
  }

  async deleteService(id: string) {
    const existing = await this.prisma.carrierService.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Serviço de transportadora '${id}' não encontrado.`);
    return this.prisma.carrierService.delete({ where: { id } });
  }

  // Carrier Service Zones
  async createServiceZone(serviceId: string, input: { zoneCode?: string; name: string; originCountryId?: string; destCountryId?: string; destStateCode?: string; destPostalCodeMin?: string; destPostalCodeMax?: string }) {
    const service = await this.prisma.carrierService.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException(`Serviço '${serviceId}' não encontrado.`);

    return this.prisma.carrierServiceZone.create({
      data: {
        serviceId,
        originCountryId: input.originCountryId,
        destCountryId: input.destCountryId,
        region: input.destStateCode || input.name,
        postalCodePattern: input.destPostalCodeMin ? `${input.destPostalCodeMin}-${input.destPostalCodeMax}` : undefined,
      },
    });
  }

  async findServiceZones(serviceId: string) {
    const service = await this.prisma.carrierService.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException(`Serviço '${serviceId}' não encontrado.`);
    return this.prisma.carrierServiceZone.findMany({ where: { serviceId } });
  }

  async updateServiceZone(id: string, input: any) {
    const existing = await this.prisma.carrierServiceZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Zona de serviço '${id}' não encontrada.`);
    return this.prisma.carrierServiceZone.update({ where: { id }, data: input });
  }

  async deleteServiceZone(id: string) {
    const existing = await this.prisma.carrierServiceZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Zona de serviço '${id}' não encontrada.`);
    return this.prisma.carrierServiceZone.delete({ where: { id } });
  }
}
