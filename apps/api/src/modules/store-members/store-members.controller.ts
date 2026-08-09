import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreMembersService } from './store-members.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreMemberRole, StoreMemberStatus } from '@prisma/client';

@ApiTags('Store Members & Team')
@ApiBearerAuth()
@Controller()
export class StoreMembersController {
  constructor(private readonly storeMembersService: StoreMembersService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('stores/:storeId/members/invite')
  @ApiOperation({ summary: 'Convidar novo membro para a equipe da loja' })
  async inviteMember(
    @CurrentUser('id') userId: string,
    @Param('storeId') storeId: string,
    @Body('email') email: string,
    @Body('role') role: StoreMemberRole,
    @Req() req: Request,
  ) {
    return this.storeMembersService.inviteMember(userId, storeId, email, role, this.extractReqInfo(req));
  }

  @Get('stores/:storeId/members')
  @ApiOperation({ summary: 'Listar membros da equipe da loja' })
  async listMembers(
    @CurrentUser('id') userId: string,
    @Param('storeId') storeId: string,
  ) {
    return this.storeMembersService.listMembers(userId, storeId);
  }

  @Patch('stores/:storeId/members/:memberId')
  @ApiOperation({ summary: 'Atualizar papel ou status de um membro da equipe' })
  async updateMember(
    @CurrentUser('id') userId: string,
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: StoreMemberRole,
    @Body('status') status: StoreMemberStatus,
    @Req() req: Request,
  ) {
    return this.storeMembersService.updateMember(userId, storeId, memberId, role, status, this.extractReqInfo(req));
  }

  @Delete('stores/:storeId/members/:memberId')
  @ApiOperation({ summary: 'Remover membro da equipe da loja' })
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    return this.storeMembersService.removeMember(userId, storeId, memberId, this.extractReqInfo(req));
  }

  @Post('store-invitations/:token/accept')
  @ApiOperation({ summary: 'Aceitar convite para equipe da loja' })
  async acceptInvitation(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    return this.storeMembersService.acceptInvitation(userId, token, this.extractReqInfo(req));
  }

  @Post('store-invitations/:token/reject')
  @ApiOperation({ summary: 'Rejeitar convite para equipe da loja' })
  async rejectInvitation(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    return this.storeMembersService.rejectInvitation(userId, token, this.extractReqInfo(req));
  }
}
