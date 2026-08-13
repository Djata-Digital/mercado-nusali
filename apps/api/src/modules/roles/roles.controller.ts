import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Request } from 'express';

import { RolesService } from './roles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import {
  CreateRoleDto,
  UpdateRoleDto,
} from './dto/admin-role.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
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
  )
  @ApiOperation({
    summary:
      'Listar todas as roles do sistema',
  })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @Roles('GLOBAL_ADMIN')
  @ApiOperation({
    summary:
      'Criar role administrativa',
  })
  async create(
    @CurrentUser('id')
    actorId: string,

    @Body()
    dto: CreateRoleDto,

    @Req()
    req: Request,
  ) {
    return this.rolesService.create(
      dto,
      actorId,
      this.extractReqInfo(req),
    );
  }

  @Patch(':id')
  @Roles('GLOBAL_ADMIN')
  @ApiOperation({
    summary:
      'Alterar role e sua matriz de permissões',
  })
  async update(
    @Param('id')
    id: string,

    @CurrentUser('id')
    actorId: string,

    @Body()
    dto: UpdateRoleDto,

    @Req()
    req: Request,
  ) {
    return this.rolesService.update(
      id,
      dto,
      actorId,
      this.extractReqInfo(req),
    );
  }

  @Delete(':id')
  @Roles('GLOBAL_ADMIN')
  @ApiOperation({
    summary:
      'Excluir role personalizada sem usuários',
  })
  async remove(
    @Param('id')
    id: string,

    @CurrentUser('id')
    actorId: string,

    @Req()
    req: Request,
  ) {
    return this.rolesService.remove(
      id,
      actorId,
      this.extractReqInfo(req),
    );
  }
}