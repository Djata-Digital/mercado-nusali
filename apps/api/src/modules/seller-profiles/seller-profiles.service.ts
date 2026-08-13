import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OnboardingSellerDto } from './dto/onboarding.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { UpdateSellerStatusDto } from './dto/update-seller-status.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { SellerStatus, SellerOnboardingStatus, SellerType, DocumentStatus } from '@prisma/client';

@Injectable()
export class SellerProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onboarding(userId: string, dto: OnboardingSellerDto, reqInfo: any) {
    const existing = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Usuário já possui um perfil de vendedor cadastrado.');
    }

    const country = await this.prisma.country.findUnique({
      where: { code: dto.countryCode.toUpperCase() },
    });

    if (!country) {
      throw new BadRequestException('País não encontrado ou não suportado.');
    }

    const seller = await this.prisma.sellerProfile.create({
      data: {
        userId,
        sellerType: dto.sellerType,
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        taxId: dto.taxId,
        registrationNumber: dto.registrationNumber,
        countryId: country.id,
        businessEmail: dto.businessEmail,
        businessPhone: dto.businessPhone,
        website: dto.website,
        description: dto.description,
        status: SellerStatus.PENDING,
        onboardingStatus: SellerOnboardingStatus.IN_PROGRESS,
      },
      include: { country: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { sellerOnboardingStatus: 'IN_PROGRESS' },
    });

    await this.auditService.log({
      userId,
      action: 'SELLER_ONBOARDING_STARTED',
      entity: 'SellerProfile',
      entityId: seller.id,
      newValue: { legalName: seller.legalName, status: seller.status },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return seller;
  }

  async getMyProfile(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: {
        country: true,
        documents: true,
        stores: true,

        user: {
          include: {
            preferredCurrency: true,

            addresses: {
              where: {
                deletedAt: null,
                isActive: true,
                type: 'COMMERCIAL',
              },
              include: {
                country: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException(
        'Perfil de vendedor não encontrado.',
      );
    }

    return seller;
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateSellerProfileDto,
    reqInfo: any,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException(
        'Perfil de vendedor não encontrado.',
      );
    }

    const {
      countryCode,
      preferredCurrencyCode,
      ...sellerData
    } = dto;

    let countryId: string | undefined;
    let preferredCurrencyId: string | undefined;

    if (countryCode) {
      const country = await this.prisma.country.findUnique({
        where: {
          code: countryCode.trim().toUpperCase(),
        },
      });

      if (!country) {
        throw new BadRequestException(
          'País informado não existe ou não é suportado.',
        );
      }

      countryId = country.id;
    }

    if (preferredCurrencyCode) {
      const currency = await this.prisma.currency.findUnique({
        where: {
          code: preferredCurrencyCode.trim().toUpperCase(),
        },
      });

      if (!currency) {
        throw new BadRequestException(
          'Moeda informada não existe ou não é suportada.',
        );
      }

      preferredCurrencyId = currency.id;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sellerProfile.update({
        where: {
          id: seller.id,
        },

        data: {
          ...sellerData,

          ...(countryId
            ? {
                countryId,
              }
            : {}),
        },
      });

      if (preferredCurrencyId) {
        await tx.user.update({
          where: {
            id: userId,
          },

          data: {
            preferredCurrencyId,
          },
        });
      }
    });

    await this.auditService.log({
      userId,
      action: 'SELLER_PROFILE_UPDATED',
      entity: 'SellerProfile',
      entityId: seller.id,

      previousValue: {
        legalName: seller.legalName,
        tradeName: seller.tradeName,
        sellerType: seller.sellerType,
        taxId: seller.taxId,
        countryId: seller.countryId,
        businessEmail: seller.businessEmail,
        businessPhone: seller.businessPhone,
      },

      newValue: dto,

      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.getMyProfile(userId);
  }

  async getById(id: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id },
      include: {
        country: true,
        documents: true,
        stores: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Perfil de vendedor não encontrado.');
    }

    return seller;
  }

  async listSellers(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.status) where.status = query.status;
    if (query.countryId) where.countryId = query.countryId;
    if (query.search) {
      where.OR = [
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { tradeName: { contains: query.search, mode: 'insensitive' } },
        { taxId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.sellerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { country: true, user: true },
      }),
      this.prisma.sellerProfile.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async updateStatus(adminUserId: string, sellerId: string, dto: UpdateSellerStatusDto, reqInfo: any) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      include: { user: true },
    });

    if (!seller) {
      throw new NotFoundException('Perfil de vendedor não encontrado.');
    }

    // 1. Minimum KYC Document Validation when VERIFIED
    if (dto.status === SellerStatus.VERIFIED) {
      await this.validateRequiredKycDocuments(seller.id, seller.sellerType);
    }

    let onboardingStatus = seller.onboardingStatus;
    if (dto.status === SellerStatus.VERIFIED) {
      onboardingStatus = SellerOnboardingStatus.APPROVED;
    } else if (dto.status === SellerStatus.REJECTED) {
      onboardingStatus = SellerOnboardingStatus.REJECTED;
    }

    const updated = await this.prisma.sellerProfile.update({
      where: { id: sellerId },
      data: {
        status: dto.status,
        onboardingStatus,
      },
    });

    const sellerRole = await this.prisma.role.findUnique({
      where: { name: 'SELLER' },
    });

    if (dto.status === SellerStatus.VERIFIED) {
      if (sellerRole) {
        await this.prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: seller.userId,
              roleId: sellerRole.id,
            },
          },
          update: {},
          create: {
            userId: seller.userId,
            roleId: sellerRole.id,
          },
        });
      }

      await this.prisma.user.update({
        where: { id: seller.userId },
        data: { sellerOnboardingStatus: 'APPROVED' },
      });
    } else if (([SellerStatus.REJECTED, SellerStatus.SUSPENDED, SellerStatus.BLOCKED] as SellerStatus[]).includes(dto.status)) {
      // Revoke SELLER role on rejection, suspension or block
      if (sellerRole) {
        await this.prisma.userRole.deleteMany({
          where: {
            userId: seller.userId,
            roleId: sellerRole.id,
          },
        });
      }

      await this.prisma.user.update({
        where: { id: seller.userId },
        data: { sellerOnboardingStatus: 'REJECTED' },
      });
    }

    await this.auditService.log({
      userId: adminUserId,
      action: 'SELLER_STATUS_UPDATED',
      entity: 'SellerProfile',
      entityId: seller.id,
      previousValue: { status: seller.status },
      newValue: { status: dto.status, reason: dto.reason },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  private async validateRequiredKycDocuments(sellerId: string, sellerType: SellerType) {
    const now = new Date();
    const approvedDocs = await this.prisma.sellerDocument.findMany({
      where: {
        sellerId,
        status: DocumentStatus.APPROVED,
        isCurrent: true,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    const docTypes = new Set(approvedDocs.map((d) => d.documentType));

    const hasIdentity = docTypes.has('IDENTITY_DOCUMENT') || docTypes.has('PASSPORT') || docTypes.has('OWNER_IDENTITY_DOCUMENT');
    const hasSelfie = docTypes.has('SELFIE');
    const hasAddress = docTypes.has('ADDRESS_PROOF');
    const hasBusinessReg = docTypes.has('BUSINESS_REGISTRATION');
    const hasTaxDoc = docTypes.has('TAX_DOCUMENT');

    if (sellerType === SellerType.INDIVIDUAL) {
      if (!hasIdentity || !hasSelfie || !hasAddress) {
        throw new BadRequestException('Aprovação KYC recusada: Vendedor INDIVIDUAL requer documento de identidade/passaporte, selfie e comprovante de endereço aprovados.');
      }
    } else if (
      sellerType === SellerType.COMPANY ||
      sellerType === SellerType.SOLE_PROPRIETOR ||
      sellerType === SellerType.INTERNATIONAL
    ) {
      if (!hasIdentity || !hasSelfie || !hasAddress || !hasBusinessReg || !hasTaxDoc) {
        throw new BadRequestException('Aprovação KYC recusada: Empresa, Empresário ou Vendedor Internacional requer documento do responsável, selfie, comprovante de endereço, registro comercial e documento fiscal aprovados.');
      }
    } else if (sellerType === SellerType.OFFICIAL_BRAND) {
      const hasBrandProof = docTypes.has('TRADEMARK_REGISTRATION') || docTypes.has('BRAND_AUTHORIZATION');
      if (!hasIdentity || !hasSelfie || !hasAddress || !hasBusinessReg || !hasTaxDoc || !hasBrandProof) {
        throw new BadRequestException('Aprovação KYC recusada: Marca Oficial requer documentação completa da empresa, responsável e registro/autorização de marca (TRADEMARK_REGISTRATION ou BRAND_AUTHORIZATION) aprovados.');
      }
    }
  }
}
