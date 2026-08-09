import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SellerDocumentsService } from './seller-documents.service';
import { DocumentType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Seller Documents & KYC')
@ApiBearerAuth()
@Controller()
export class SellerDocumentsController {
  constructor(private readonly sellerDocumentsService: SellerDocumentsService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('seller-documents/upload/:documentType')
  @Permissions('kyc:upload:self')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Fazer upload de documento de verificação KYC' })
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @Param('documentType') documentType: DocumentType,
    @UploadedFile() file: any,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo de documento não enviado.');
    }
    return this.sellerDocumentsService.uploadDocument(userId, documentType, file, this.extractReqInfo(req));
  }

  @Get('seller-documents/me')
  @Permissions('kyc:read:self')
  @ApiOperation({ summary: 'Listar documentos KYC do próprio vendedor' })
  async getMyDocuments(@CurrentUser('id') userId: string) {
    return this.sellerDocumentsService.getMyDocuments(userId);
  }

  @Get('seller-documents/:id')
  @Permissions('kyc:read:self')
  @ApiOperation({ summary: 'Obter detalhes de um documento KYC' })
  async getDocumentById(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Param('id') docId: string,
  ) {
    const isAdmin = roles.some((r) => ['ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST'].includes(r));
    return this.sellerDocumentsService.getDocumentById(userId, docId, isAdmin);
  }

  @Get('seller-documents/:id/download-url')
  @Permissions('kyc:read:self')
  @ApiOperation({ summary: 'Gerar URL assinada temporária para download seguro' })
  async getDownloadUrl(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Param('id') docId: string,
    @Req() req: Request,
  ) {
    const isAdmin = roles.some((r) => ['ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST'].includes(r));
    return this.sellerDocumentsService.getDownloadUrl(userId, docId, isAdmin, this.extractReqInfo(req));
  }

  @Delete('seller-documents/:id')
  @Permissions('kyc:upload:self')
  @ApiOperation({ summary: 'Remover documento KYC pendente' })
  async deleteDocument(
    @CurrentUser('id') userId: string,
    @Param('id') docId: string,
    @Req() req: Request,
  ) {
    return this.sellerDocumentsService.deleteDocument(userId, docId, this.extractReqInfo(req));
  }

  // Admin Endpoints
  @Get('admin/kyc/documents')
  @Permissions('kyc:read:any')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST')
  @ApiOperation({ summary: 'Listar documentos KYC para análise (Admin)' })
  async listAdminDocuments(@Query() query: any) {
    return this.sellerDocumentsService.listAdminDocuments(query);
  }

  @Patch('admin/kyc/documents/:id/approve')
  @Permissions('kyc:approve')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST')
  @ApiOperation({ summary: 'Aprovar documento KYC específico' })
  async approveDocument(
    @CurrentUser('id') adminUserId: string,
    @Param('id') docId: string,
    @Req() req: Request,
  ) {
    return this.sellerDocumentsService.approveDocument(adminUserId, docId, this.extractReqInfo(req));
  }

  @Patch('admin/kyc/documents/:id/reject')
  @Permissions('kyc:review')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST')
  @ApiOperation({ summary: 'Rejeitar documento KYC específico com justificativa' })
  async rejectDocument(
    @CurrentUser('id') adminUserId: string,
    @Param('id') docId: string,
    @Body('reason') reason: string,
    @Req() req: Request,
  ) {
    return this.sellerDocumentsService.rejectDocument(adminUserId, docId, reason || 'Documentação inadequada.', this.extractReqInfo(req));
  }

  @Patch('admin/kyc/sellers/:sellerId/approve')
  @Permissions('kyc:approve')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST')
  @ApiOperation({ summary: 'Aprovação completa de KYC de vendedor' })
  async approveSellerKyc(
    @CurrentUser('id') adminUserId: string,
    @Param('sellerId') sellerId: string,
    @Body('notes') notes: string,
    @Req() req: Request,
  ) {
    return this.sellerDocumentsService.approveSellerKyc(adminUserId, sellerId, notes, this.extractReqInfo(req));
  }

  @Patch('admin/kyc/sellers/:sellerId/reject')
  @Permissions('kyc:review')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST')
  @ApiOperation({ summary: 'Rejeição completa de KYC de vendedor' })
  async rejectSellerKyc(
    @CurrentUser('id') adminUserId: string,
    @Param('sellerId') sellerId: string,
    @Body('reason') reason: string,
    @Req() req: Request,
  ) {
    return this.sellerDocumentsService.rejectSellerKyc(adminUserId, sellerId, reason || 'Requisitos KYC não atendidos.', this.extractReqInfo(req));
  }
}
