import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';
import { AuditService } from '../audit/audit.service';
import { SellerProfilesService } from '../seller-profiles/seller-profiles.service';
import { DocumentType, DocumentStatus, SellerStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SellerDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly auditService: AuditService,
    private readonly sellerProfilesService: SellerProfilesService,
  ) {}

  async uploadDocument(
    userId: string,
    documentType: DocumentType,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    reqInfo: any,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Perfil de vendedor não encontrado. Inicie o onboarding primeiro.');
    }

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido. Use PDF, JPEG, PNG ou WEBP.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Tamanho do arquivo excede o limite de 10MB.');
    }

    const ext = file.originalname.split('.').pop() || 'bin';
    const fileKey = `kyc/${seller.id}/${documentType.toLowerCase()}-${uuidv4()}.${ext}`;

    const uploaded = await this.minioService.uploadFile(fileKey, file.buffer, file.mimetype, false);

    // Requirement 13: Mark previous versions of same document type as not current
    await this.prisma.sellerDocument.updateMany({
      where: {
        sellerId: seller.id,
        documentType,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    const doc = await this.prisma.sellerDocument.create({
      data: {
        sellerId: seller.id,
        documentType,
        fileKey: uploaded.key,
        bucket: uploaded.bucket,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: DocumentStatus.PENDING,
        isCurrent: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'KYC_DOCUMENT_UPLOADED',
      entity: 'SellerDocument',
      entityId: doc.id,
      newValue: { documentType, fileName: file.originalname, fileSize: file.size },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return doc;
  }

  async getMyDocuments(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Perfil de vendedor não encontrado.');
    }

    return this.prisma.sellerDocument.findMany({
      where: { sellerId: seller.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentById(userId: string, docId: string, isAdmin: boolean = false) {
    const doc = await this.prisma.sellerDocument.findUnique({
      where: { id: docId },
      include: { seller: true },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Documento não encontrado.');
    }

    if (!isAdmin && doc.seller.userId !== userId) {
      throw new ForbiddenException('Acesso negado a este documento.');
    }

    return doc;
  }

  async getDownloadUrl(userId: string, docId: string, isAdmin: boolean = false, reqInfo: any = {}) {
    const doc = await this.getDocumentById(userId, docId, isAdmin);

    const signedUrl = await this.minioService.getSignedUrl(doc.fileKey, 900); // 15 min

    await this.auditService.log({
      userId,
      action: 'KYC_DOCUMENT_DOWNLOADED',
      entity: 'SellerDocument',
      entityId: doc.id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return {
      downloadUrl: signedUrl,
      expiresInSeconds: 900,
    };
  }

  async deleteDocument(userId: string, docId: string, reqInfo: any) {
    const doc = await this.getDocumentById(userId, docId);

    // Retention policy: Mark soft-delete / archived in database for legal compliance
    await this.prisma.sellerDocument.update({
      where: { id: docId },
      data: { deletedAt: new Date(), isCurrent: false },
    });

    await this.auditService.log({
      userId,
      action: 'KYC_DOCUMENT_DELETED',
      entity: 'SellerDocument',
      entityId: docId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Documento arquivado com sucesso.' };
  }

  // Admin KYC Endpoints
  async listAdminDocuments(query: any) {
    return this.listPendingDocuments(query);
  }

  async listPendingDocuments(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.documentType) where.documentType = query.documentType;

    const [items, total] = await Promise.all([
      this.prisma.sellerDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: {
            select: {
              id: true,
              userId: true,
              sellerType: true,
              legalName: true,
              tradeName: true,
              taxId: true,
              registrationNumber: true,
              status: true,
              verificationLevel: true,
              onboardingStatus: true,
              countryId: true,
              businessEmail: true,
              businessPhone: true,
              website: true,
              description: true,
              averageRating: true,
              totalReviews: true,
              totalSales: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  phoneCode: true,
                  status: true,
                  isEmailVerified: true,
                  isPhoneVerified: true,
                  countryId: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.sellerDocument.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async approveDocument(adminUserId: string, docId: string, reqInfo: any) {
    const doc = await this.prisma.sellerDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const updated = await this.prisma.sellerDocument.update({
      where: { id: docId },
      data: {
        status: DocumentStatus.APPROVED,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'KYC_DOCUMENT_APPROVED',
      entity: 'SellerDocument',
      entityId: docId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async rejectDocument(adminUserId: string, docId: string, reason: string, reqInfo: any) {
    const doc = await this.prisma.sellerDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const updated = await this.prisma.sellerDocument.update({
      where: { id: docId },
      data: {
        status: DocumentStatus.REJECTED,
        rejectionReason: reason,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'KYC_DOCUMENT_REJECTED',
      entity: 'SellerDocument',
      entityId: docId,
      newValue: { reason },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async approveSellerKyc(adminUserId: string, sellerId: string, notes?: string, reqInfo: any = {}) {
    // Delegate seller verification to centralized SellerProfilesService which checks minimum KYC documents!
    await this.sellerProfilesService.updateStatus(
      adminUserId,
      sellerId,
      { status: SellerStatus.VERIFIED, reason: notes },
      reqInfo,
    );

    await this.prisma.sellerKycReview.create({
      data: {
        sellerId,
        reviewerId: adminUserId,
        decision: 'APPROVED',
        notes,
      },
    });

    await this.prisma.sellerKycEvent.create({
      data: {
        sellerId,
        eventType: 'KYC_APPROVED',
        description: notes || 'Aprovação completa de KYC do vendedor.',
      },
    });

    return { message: 'KYC do vendedor aprovado com sucesso.' };
  }

  async rejectSellerKyc(adminUserId: string, sellerId: string, reason: string, reqInfo: any = {}) {
    await this.sellerProfilesService.updateStatus(
      adminUserId,
      sellerId,
      { status: SellerStatus.REJECTED, reason },
      reqInfo,
    );

    await this.prisma.sellerKycReview.create({
      data: {
        sellerId,
        reviewerId: adminUserId,
        decision: 'REJECTED',
        notes: reason,
      },
    });

    await this.prisma.sellerKycEvent.create({
      data: {
        sellerId,
        eventType: 'KYC_REJECTED',
        description: reason,
      },
    });

    return { message: 'KYC do vendedor rejeitado.' };
  }
}
