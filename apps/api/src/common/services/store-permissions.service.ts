import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { StoreMemberRole, StoreMemberStatus, SellerStatus } from '@prisma/client';

export type StoreAction =
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_TEAM'
  | 'VIEW_FINANCIALS'
  | 'MANAGE_CUSTOMER_SERVICE'
  | 'VIEW_INVENTORY'
  | 'MANAGE_INVENTORY';

@Injectable()
export class StorePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateStoreAccess(
    userId: string,
    storeId: string,
    action: StoreAction,
    targetMemberRole?: StoreMemberRole,
  ): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { seller: true },
    });

    if (!store || store.deletedAt) {
      throw new NotFoundException('Loja não encontrada.');
    }

    // Owner of the seller profile must be VERIFIED
    if (store.seller.userId === userId) {
      if (store.seller.status !== SellerStatus.VERIFIED) {
        throw new ForbiddenException('O perfil de vendedor não está VERIFIED. Acesso negado.');
      }
      return;
    }

    const member = await this.prisma.storeMember.findFirst({
      where: {
        storeId,
        userId,
        status: StoreMemberStatus.ACTIVE,
      },
    });

    if (!member) {
      throw new ForbiddenException('Acesso negado. Você não é membro ativo desta loja.');
    }

    const role = member.role;

    switch (action) {
      case 'MANAGE_PRODUCTS':
        if (!([StoreMemberRole.OWNER, StoreMemberRole.MANAGER, StoreMemberRole.INVENTORY_MANAGER] as StoreMemberRole[]).includes(role)) {
          throw new ForbiddenException(`Seu papel na loja (${role}) não tem permissão para gerenciar produtos.`);
        }
        break;

      case 'VIEW_INVENTORY':
        if (!([StoreMemberRole.OWNER, StoreMemberRole.MANAGER, StoreMemberRole.INVENTORY_MANAGER, StoreMemberRole.FINANCE, StoreMemberRole.ORDER_OPERATOR, StoreMemberRole.CUSTOMER_SERVICE] as StoreMemberRole[]).includes(role)) {
          throw new ForbiddenException(`Seu papel na loja (${role}) não tem permissão para visualizar o estoque.`);
        }
        break;

      case 'MANAGE_INVENTORY':
        if (!([StoreMemberRole.OWNER, StoreMemberRole.MANAGER, StoreMemberRole.INVENTORY_MANAGER] as StoreMemberRole[]).includes(role)) {
          throw new ForbiddenException(`Seu papel na loja (${role}) não tem permissão para alterar o estoque.`);
        }
        break;

      case 'MANAGE_TEAM':
        if (!([StoreMemberRole.OWNER, StoreMemberRole.MANAGER] as StoreMemberRole[]).includes(role)) {
          throw new ForbiddenException(`Seu papel na loja (${role}) não tem permissão para gerenciar a equipe.`);
        }
        if (role === StoreMemberRole.MANAGER && targetMemberRole === StoreMemberRole.OWNER) {
          throw new ForbiddenException('Gerentes não podem alterar ou remover o Proprietário (OWNER) da loja.');
        }
        break;

      case 'VIEW_FINANCIALS':
        if (!([StoreMemberRole.OWNER, StoreMemberRole.FINANCE] as StoreMemberRole[]).includes(role)) {
          throw new ForbiddenException(`Seu papel na loja (${role}) não tem permissão para dados financeiros.`);
        }
        break;

      case 'MANAGE_CUSTOMER_SERVICE':
        if (!([StoreMemberRole.OWNER, StoreMemberRole.MANAGER, StoreMemberRole.CUSTOMER_SERVICE] as StoreMemberRole[]).includes(role)) {
          throw new ForbiddenException(`Seu papel na loja (${role}) não tem permissão para atendimento ao cliente.`);
        }
        break;

      default:
        throw new ForbiddenException('Ação não autorizada na loja.');
    }
  }
}
