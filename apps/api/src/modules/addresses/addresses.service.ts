import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createAddress(userId: string, dto: CreateAddressDto, reqInfo: any) {
    const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
    if (!country) {
      throw new BadRequestException('País informado não existe.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingAddressesCount = await tx.address.count({
        where: { userId, deletedAt: null, isActive: true },
      });

      const isDefault = dto.isDefault || existingAddressesCount === 0;

      if (isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          label: dto.label,
          recipientName: dto.recipientName,
          phone: dto.phone,
          phoneCode: dto.phoneCode,
          countryId: dto.countryId,
          region: dto.region,
          city: dto.city,
          district: dto.district,
          neighborhood: dto.neighborhood,
          street: dto.street,
          number: dto.number,
          complement: dto.complement,
          postalCode: dto.postalCode,
          reference: dto.reference,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault,
          type: dto.type || 'RESIDENTIAL',
        },
        include: { country: true },
      });
    });

    await this.auditService.log({
      userId,
      action: 'ADDRESS_CREATED',
      entity: 'Address',
      entityId: result.id,
      newValue: { label: result.label, city: result.city },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async listUserAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: { country: true },
    });
  }

  async getAddressById(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
      include: { country: true },
    });

    if (!address || address.deletedAt || !address.isActive) {
      throw new NotFoundException('Endereço não encontrado.');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('Acesso negado ao endereço de outro usuário.');
    }

    return address;
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto, reqInfo: any) {
    const address = await this.getAddressById(userId, addressId);

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: {
          label: dto.label,
          recipientName: dto.recipientName,
          phone: dto.phone,
          phoneCode: dto.phoneCode,
          region: dto.region,
          city: dto.city,
          district: dto.district,
          neighborhood: dto.neighborhood,
          street: dto.street,
          number: dto.number,
          complement: dto.complement,
          postalCode: dto.postalCode,
          reference: dto.reference,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: dto.isDefault,
          type: dto.type,
        },
        include: { country: true },
      });
    });

    await this.auditService.log({
      userId,
      action: 'ADDRESS_UPDATED',
      entity: 'Address',
      entityId: result.id,
      previousValue: { label: address.label, isDefault: address.isDefault },
      newValue: { label: result.label, isDefault: result.isDefault },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async setDefaultAddress(userId: string, addressId: string, reqInfo: any) {
    await this.getAddressById(userId, addressId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
        include: { country: true },
      });
    });

    await this.auditService.log({
      userId,
      action: 'ADDRESS_SET_DEFAULT',
      entity: 'Address',
      entityId: result.id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async deleteAddress(userId: string, addressId: string, reqInfo: any) {
    const address = await this.getAddressById(userId, addressId);

    // Soft delete requirement (Requirement 15)
    await this.prisma.address.update({
      where: { id: addressId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        isDefault: false,
      },
    });

    await this.auditService.log({
      userId,
      action: 'ADDRESS_DELETED',
      entity: 'Address',
      entityId: addressId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Endereço removido com sucesso.' };
  }
}
