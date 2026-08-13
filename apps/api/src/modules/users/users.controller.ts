import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import {
  AdminCreateUserDto,
  AdminListUsersQueryDto,
  AdminUpdateUserRolesDto,
  AdminUpdateUserStatusDto,
} from './dto/admin-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress:
        req.ip ||
        req.socket.remoteAddress,

      userAgent:
        req.headers['user-agent'],

      country:
        req.headers[
          'x-country-code'
        ] as string | undefined,

      requestId:
        (req as any).requestId,
    };
  }

  @Get()
  @Roles(
    'ADMIN',
    'GLOBAL_ADMIN',
    'SUPPORT',
  )
  @ApiOperation({
    summary:
      'Listar usuários com filtros e paginação',
  })
  async list(
    @Query()
    query: AdminListUsersQueryDto,
  ) {
    return this.usersService.adminList(
      query,
    );
  }

  @Post()
  @Roles('GLOBAL_ADMIN')
  @ApiOperation({
    summary:
      'Criar usuário administrativamente',
  })
  async create(
    @CurrentUser('id')
    actorId: string,

    @Body()
    dto: AdminCreateUserDto,

    @Req()
    req: Request,
  ) {
    return this.usersService.adminCreate(
      dto,
      actorId,
      this.extractReqInfo(req),
    );
  }

  @Patch(':id/status')
  @Roles(
    'ADMIN',
    'GLOBAL_ADMIN',
  )
  @ApiOperation({
    summary:
      'Bloquear, suspender, desativar ou reativar usuário',
  })
  async updateStatus(
    @Param('id')
    targetUserId: string,

    @CurrentUser('id')
    actorId: string,

    @Body()
    dto: AdminUpdateUserStatusDto,

    @Req()
    req: Request,
  ) {
    return this.usersService.adminUpdateStatus(
      targetUserId,
      dto.status,
      dto.reason,
      actorId,
      this.extractReqInfo(req),
    );
  }

  @Patch(':id/roles')
  @Roles('GLOBAL_ADMIN')
  @ApiOperation({
    summary:
      'Substituir roles do usuário',
  })
  async updateRoles(
    @Param('id')
    targetUserId: string,

    @CurrentUser('id')
    actorId: string,

    @Body()
    dto: AdminUpdateUserRolesDto,

    @Req()
    req: Request,
  ) {
    return this.usersService.adminUpdateRoles(
      targetUserId,
      dto.roles,
      actorId,
      this.extractReqInfo(req),
    );
  }

  @Post(':id/password-reset')
  @Roles(
    'ADMIN',
    'GLOBAL_ADMIN',
  )
  @ApiOperation({
    summary:
      'Enviar redefinição segura de senha ao usuário',
  })
  async sendPasswordReset(
    @Param('id')
    targetUserId: string,

    @CurrentUser('id')
    actorId: string,

    @Req()
    req: Request,
  ) {
    return this.usersService.adminSendPasswordReset(
      targetUserId,
      actorId,
      this.extractReqInfo(req),
    );
  }

  @Get(':id')
  @Roles(
    'ADMIN',
    'GLOBAL_ADMIN',
    'SUPPORT',
  )
  @ApiOperation({
    summary:
      'Obter perfil de usuário por ID',
  })
  async findById(
    @Param('id') id: string,
  ) {
    return this.usersService.findById(id);
  }
}