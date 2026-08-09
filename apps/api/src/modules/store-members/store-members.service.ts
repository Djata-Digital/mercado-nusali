import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorePermissionsService } from '../../common/services/store-permissions.service';
import { HashUtil } from '../../common/utils/hash.util';
import { StoreMemberRole, StoreMemberStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StoreMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storePermissionsService: StorePermissionsService,
  ) {}

  async inviteMember(
    userId: string,
    storeId: string,
    email: string,
    role: StoreMemberRole,
    reqInfo: any,
  ) {
    await this.storePermissionsService.validateStoreAccess(userId, storeId, 'MANAGE_TEAM');

    if (role === StoreMemberRole.OWNER) {
      throw new BadRequestException('Não é possível convidar como OWNER diretamente.');
    }

    const invitedUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (invitedUser) {
      const existingMember = await this.prisma.storeMember.findUnique({
        where: { storeId_userId: { storeId, userId: invitedUser.id } },
      });

      if (existingMember && existingMember.status === StoreMemberStatus.ACTIVE) {
        throw new ConflictException('Usuário já é membro ativo desta loja.');
      }
    }

    // Invalidate previous pending invitations for same store and email
    await this.prisma.storeInvitation.updateMany({
      where: {
        storeId,
        email: email.toLowerCase(),
        status: 'PENDING',
      },
      data: { status: 'EXPIRED' },
    });

    const rawToken = uuidv4();
    const tokenHash = HashUtil.hash(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.storeInvitation.create({
      data: {
        storeId,
        email: email.toLowerCase(),
        role,
        tokenHash,
        invitedById: userId,
        expiresAt,
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      userId,
      action: 'STORE_MEMBER_INVITED',
      entity: 'StoreInvitation',
      entityId: invitation.id,
      newValue: { email, role, storeId },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return {
      invitationId: invitation.id,
      storeId: invitation.storeId,
      email: invitation.email,
      role: invitation.role,
      token: rawToken,
      expiresAt: invitation.expiresAt,
    };
  }

  async listMembers(userId: string, storeId: string) {
    await this.storePermissionsService.validateStoreAccess(userId, storeId, 'MANAGE_TEAM');

    return this.prisma.storeMember.findMany({
      where: { storeId },
      include: { user: true, invitedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateMember(
    userId: string,
    storeId: string,
    memberId: string,
    role: StoreMemberRole,
    status: StoreMemberStatus,
    reqInfo: any,
  ) {
    const member = await this.prisma.storeMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.storeId !== storeId) {
      throw new NotFoundException('Membro da loja não encontrado.');
    }

    await this.storePermissionsService.validateStoreAccess(userId, storeId, 'MANAGE_TEAM', member.role);

    if (member.role === StoreMemberRole.OWNER && role !== StoreMemberRole.OWNER) {
      throw new BadRequestException('O papel de OWNER não pode ser alterado diretamente sem transferência.');
    }

    const updated = await this.prisma.storeMember.update({
      where: { id: memberId },
      data: { role, status },
    });

    await this.auditService.log({
      userId,
      action: 'STORE_MEMBER_UPDATED',
      entity: 'StoreMember',
      entityId: memberId,
      newValue: { role, status },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async removeMember(userId: string, storeId: string, memberId: string, reqInfo: any) {
    const member = await this.prisma.storeMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.storeId !== storeId) {
      throw new NotFoundException('Membro da loja não encontrado.');
    }

    await this.storePermissionsService.validateStoreAccess(userId, storeId, 'MANAGE_TEAM', member.role);

    if (member.role === StoreMemberRole.OWNER) {
      throw new BadRequestException('O proprietário (OWNER) da loja não pode ser removido.');
    }

    await this.prisma.storeMember.delete({
      where: { id: memberId },
    });

    await this.auditService.log({
      userId,
      action: 'STORE_MEMBER_REMOVED',
      entity: 'StoreMember',
      entityId: memberId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Membro removido da loja com sucesso.' };
  }

  async acceptInvitation(userId: string, token: string, reqInfo: any) {
    const tokenHash = HashUtil.hash(token);

    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { tokenHash },
      include: { store: true },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Convite de loja inválido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException('O convite de membro da loja foi enviado para outro endereço de e-mail.');
    }

    const member = await this.prisma.storeMember.upsert({
      where: {
        storeId_userId: {
          storeId: invitation.storeId,
          userId,
        },
      },
      update: {
        role: invitation.role,
        status: StoreMemberStatus.ACTIVE,
      },
      create: {
        storeId: invitation.storeId,
        userId,
        role: invitation.role,
        status: StoreMemberStatus.ACTIVE,
        invitedById: invitation.invitedById,
      },
    });

    await this.prisma.storeInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });

    await this.auditService.log({
      userId,
      action: 'STORE_INVITATION_ACCEPTED',
      entity: 'StoreMember',
      entityId: member.id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return member;
  }

  async rejectInvitation(userId: string, token: string, reqInfo: any) {
    const tokenHash = HashUtil.hash(token);

    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Convite de loja inválido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException('O convite de membro da loja foi enviado para outro endereço de e-mail.');
    }

    await this.prisma.storeInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REJECTED' },
    });

    return { message: 'Convite rejeitado.' };
  }
}
