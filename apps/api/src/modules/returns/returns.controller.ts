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

import {
  ReturnStatus,
} from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

import {
  AdminAuthorizeReturnDto,
  AdminInspectReturnDto,
  AdminRejectReturnDto,
  AdminReturnListQueryDto,
  CreateReturnRequestDto,
} from './dto/returns.dto';

import { ReturnsService } from './returns.service';

@ApiTags('Returns')
@ApiBearerAuth('JWT')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller('returns')
export class ReturnsController {
  constructor(
    private readonly returns:
      ReturnsService,
  ) {}

  @Post()
  @Permissions(
    'order:read:self',
  )
  @ApiOperation({
    summary:
      'Solicitar devolução de itens de um pedido entregue',
  })
  async create(
    @Req()
    req: any,

    @Body()
    dto: CreateReturnRequestDto,
  ) {
    return {
      success: true,

      data:
        await this.returns.createBuyerReturn(
          req.user.id,
          dto,
        ),
    };
  }

  @Get('me')
  @Permissions(
    'order:read:self',
  )
  @ApiOperation({
    summary:
      'Listar devoluções do comprador autenticado',
  })
  async myReturns(
    @Req()
    req: any,
  ) {
    return {
      success: true,

      data:
        await this.returns.listBuyerReturns(
          req.user.id,
        ),
    };
  }

  @Get('me/:id')
  @Permissions(
    'order:read:self',
  )
  async myReturn(
    @Req()
    req: any,

    @Param('id')
    id: string,
  ) {
    return {
      success: true,

      data:
        await this.returns.getBuyerReturn(
          req.user.id,
          id,
        ),
    };
  }

  /*
   * ==========================================================
   * ADMIN
   * ==========================================================
   */

  @Get('admin/all')
  @Permissions(
    'manage_orders',
  )
  @ApiOperation({
    summary:
      'Listar devoluções globalmente para administração',
  })
  async adminList(
    @Query()
    query:
      AdminReturnListQueryDto,
  ) {
    return {
      success: true,

      data:
        await this.returns.listAdminReturns(
          query.status,
          query.limit,
        ),
    };
  }

  @Get('admin/:id')
  @Permissions(
    'manage_orders',
  )
  async adminGet(
    @Param('id')
    id: string,
  ) {
    return {
      success: true,

      data:
        await this.returns.getAdminReturn(
          id,
        ),
    };
  }

  @Post(
    'admin/:id/authorize',
  )
  @Permissions(
    'manage_orders',
  )
  async authorize(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    dto:
      AdminAuthorizeReturnDto,
  ) {
    return {
      success: true,

      data:
        await this.returns.authorize(
          id,
          req.user.id,
          dto,
        ),
    };
  }

  @Post(
    'admin/:id/reject',
  )
  @Permissions(
    'manage_orders',
  )
  async reject(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    dto:
      AdminRejectReturnDto,
  ) {
    return {
      success: true,

      data:
        await this.returns.reject(
          id,
          req.user.id,
          dto.reason,
        ),
    };
  }

  @Post(
    'admin/:id/in-transit',
  )
  @Permissions(
    'manage_orders',
  )
  async inTransit(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    body: {
      note?: string;
    },
  ) {
    return {
      success: true,

      data:
        await this.returns.markInTransit(
          id,
          req.user.id,
          body?.note,
        ),
    };
  }

  @Post(
    'admin/:id/receive',
  )
  @Permissions(
    'manage_orders',
  )
  async receive(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    body: {
      note?: string;
    },
  ) {
    return {
      success: true,

      data:
        await this.returns.receiveAtHub(
          id,
          req.user.id,
          body?.note,
        ),
    };
  }

  @Post(
    'admin/:id/start-inspection',
  )
  @Permissions(
    'manage_orders',
  )
  async startInspection(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    body: {
      note?: string;
    },
  ) {
    return {
      success: true,

      data:
        await this.returns.startInspection(
          id,
          req.user.id,
          body?.note,
        ),
    };
  }

  @Post(
    'admin/:id/inspect',
  )
  @Permissions(
    'manage_orders',
  )
  async inspect(
    @Param('id')
    id: string,

    @Req()
    req: any,

    @Body()
    dto:
      AdminInspectReturnDto,
  ) {
    return {
      success: true,

      data:
        await this.returns.inspect(
          id,
          req.user.id,
          dto,
        ),
    };
  }

  @Post(
    'admin/:id/refund',
  )
  @Permissions(
    'manage_orders',
    'refund:admin:operate',
  )
  @ApiOperation({
    summary:
      'Gerar reembolso real para devolução aprovada',
  })
  async refund(
    @Param('id')
    id: string,

    @Req()
    req: any,
  ) {
    return {
      success: true,

      data:
        await this.returns.createRefundForReturn(
          id,
          req.user.id,
        ),
    };
  }

  @Post(
    'admin/:id/sync-refund',
  )
  @Permissions(
    'manage_orders',
    'refund:admin:read',
  )
  @ApiOperation({
    summary:
      'Sincronizar estado da devolução com o refund vinculado',
  })
  async syncRefund(
    @Param('id')
    id: string,

    @Req()
    req: any,
  ) {
    return {
      success: true,

      data:
        await this.returns.syncRefundStatus(
          id,
          req.user.id,
        ),
    };
  }
}