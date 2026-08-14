import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

import {
  AdminSupportListQueryDto,
  AssignSupportTicketDto,
  CreateSupportMessageDto,
  CreateSupportTicketDto,
  UpdateSupportPriorityDto,
  UpdateSupportStatusDto,
} from './dto/support.dto';

import { SupportService } from './support.service';

@ApiTags('Support')
@ApiBearerAuth('JWT')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller('support')
export class SupportController {
  constructor(
    private readonly support:
      SupportService,
  ) {}

  @Post('tickets')
  @Permissions(
    'order:read:self',
  )
  @ApiOperation({
    summary:
      'Abrir chamado de suporte',
  })
  async create(
    @Req()
    req: any,

    @Body()
    dto:
      CreateSupportTicketDto,
  ) {
    return {
      success: true,

      data:
        await this.support.createTicket(
          req.user.id,
          dto,
        ),
    };
  }

  @Get('tickets/me')
  @Permissions(
    'order:read:self',
  )
  async myTickets(
    @Req()
    req: any,
  ) {
    return {
      success: true,

      data:
        await this.support.listMyTickets(
          req.user.id,
        ),
    };
  }

  @Get('tickets/me/:id')
  @Permissions(
    'order:read:self',
  )
  async myTicket(
    @Req()
    req: any,

    @Param('id')
    id: string,
  ) {
    return {
      success: true,

      data:
        await this.support.getMyTicket(
          req.user.id,
          id,
        ),
    };
  }

  @Post(
    'tickets/me/:id/messages',
  )
  @Permissions(
    'order:read:self',
  )
  async customerMessage(
    @Req()
    req: any,

    @Param('id')
    id: string,

    @Body()
    dto:
      CreateSupportMessageDto,
  ) {
    return {
      success: true,

      data:
        await this.support.addCustomerMessage(
          req.user.id,
          id,
          dto.message,
        ),
    };
  }

  @Get('admin/tickets')
  @Permissions(
    'manage_users',
  )
  async adminList(
    @Query()
    query:
      AdminSupportListQueryDto,
  ) {
    return {
      success: true,

      data:
        await this.support.adminList(
          query,
        ),
    };
  }

  @Get(
    'admin/tickets/:id',
  )
  @Permissions(
    'manage_users',
  )
  async adminGet(
    @Param('id')
    id: string,
  ) {
    return {
      success: true,

      data:
        await this.support.adminGet(
          id,
        ),
    };
  }

  @Post(
    'admin/tickets/:id/assign',
  )
  @Permissions(
    'manage_users',
  )
  async assign(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    dto:
      AssignSupportTicketDto,
  ) {
    return {
      success: true,

      data:
        await this.support.assign(
          id,
          dto.userId,
          req.user.id,
        ),
    };
  }

  @Post(
    'admin/tickets/:id/messages',
  )
  @Permissions(
    'manage_users',
  )
  async adminReply(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    dto:
      CreateSupportMessageDto,
  ) {
    return {
      success: true,

      data:
        await this.support.adminReply(
          id,
          req.user.id,
          dto.message,
          dto.isInternal === true,
        ),
    };
  }

  @Patch(
    'admin/tickets/:id/status',
  )
  @Permissions(
    'manage_users',
  )
  async status(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    dto:
      UpdateSupportStatusDto,
  ) {
    return {
      success: true,

      data:
        await this.support.updateStatus(
          id,
          dto.status,
          req.user.id,
          dto.reason,
        ),
    };
  }

  @Patch(
    'admin/tickets/:id/priority',
  )
  @Permissions(
    'manage_users',
  )
  async priority(
    @Param('id')
    id: string,

    @Body()
    dto:
      UpdateSupportPriorityDto,
  ) {
    return {
      success: true,

      data:
        await this.support.updatePriority(
          id,
          dto.priority,
        ),
    };
  }
}