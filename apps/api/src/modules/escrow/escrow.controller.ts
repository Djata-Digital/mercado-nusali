import {
  Body,
  Controller,
  Get,
  Param,
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

import { EscrowService } from './escrow.service';

import {
  AdminDisputeMessageDto,
  AdminResolveDisputeDto,
  DisputeEscrowDto,
  RefundEscrowDto,
  ReleaseEscrowDto,
  ResolveEscrowDisputeDto,
} from './dto/escrow.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Escrow')
@ApiBearerAuth('JWT')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller('escrow')
export class EscrowController {
  constructor(
    private readonly escrowService:
      EscrowService,
  ) {}

  @Get('orders/:orderId')
  @Permissions(
    'escrow:read:self',
  )
  @ApiOperation({
    summary:
      'Consultar conta de custódia (Escrow) de um pedido',
  })
  async getByOrderId(
    @Param('orderId')
    orderId: string,
  ) {
    const data =
      await this.escrowService.getEscrowByOrderId(
        orderId,
      );

    return {
      success: true,
      data,
    };
  }

  @Post('release')
  @Permissions(
    'escrow:release:manage',
  )
  @ApiOperation({
    summary:
      'Liberar fundos em custódia para o vendedor',
  })
  async releaseEscrow(
    @Body()
    dto: ReleaseEscrowDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      dto.amount === undefined
        ? await this.escrowService.releaseEscrow(
            dto.orderId,
            undefined,
            actorUserId,
          )
        : await this.escrowService.releasePartial(
            dto.orderId,
            dto.amount,
            undefined,
            actorUserId,
          );

    return {
      success: true,
      data,
    };
  }

  @Post('refund')
  @Permissions(
    'escrow:release:manage',
  )
  @ApiOperation({
    summary:
      'Reembolsar ao comprador o saldo ainda retido no Escrow',
  })
  async refundEscrow(
    @Body()
    dto: RefundEscrowDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      await this.escrowService.refundEscrow(
        dto.orderId,
        dto.amount,
        undefined,
        actorUserId,
      );

    return {
      success: true,
      data,
    };
  }

  @Post('cancel')
  @Permissions(
    'escrow:release:manage',
  )
  @ApiOperation({
    summary:
      'Cancelar financeiramente o Escrow de um pedido já cancelado',
  })
  async cancelEscrow(
    @Body()
    dto: DisputeEscrowDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      await this.escrowService.cancelEscrow(
        dto.orderId,
        undefined,
        actorUserId,
      );

    return {
      success: true,
      data,
    };
  }

  /*
   * ============================================================
   * DISPUTA - FLUXO OPERACIONAL
   * ============================================================
   */

  @Post('disputes/open')
  @Permissions(
    'escrow:release:manage',
  )
  @ApiOperation({
    summary:
      'Abrir disputa e congelar movimentações automáticas do Escrow',
  })
  async openDispute(
    @Body()
    dto: DisputeEscrowDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      await this.escrowService.openDispute(
        dto.orderId,
        actorUserId,
        dto.reason,
      );

    return {
      success: true,
      data,
    };
  }

  @Post('disputes/resolve')
  @Permissions(
    'escrow:release:manage',
  )
  @ApiOperation({
    summary:
      'Resolver disputa em favor do comprador ou vendedor',
  })
  async resolveDispute(
    @Body()
    dto: ResolveEscrowDisputeDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      await this.escrowService.resolveDispute(
        dto.orderId,
        dto.outcome,
        actorUserId,
        dto.note,
      );

    return {
      success: true,
      data,
    };
  }

  /*
   * ============================================================
   * ADMIN DISPUTES
   * ============================================================
   */

  @Get('admin/disputes')
  @Permissions(
    'manage_disputes',
  )
  @ApiOperation({
    summary:
      'Listar disputas reais da plataforma',
  })
  async listAdminDisputes(
    @Query('status')
    status?: string,

    @Query('limit')
    limit?: string,
  ) {
    const data =
      await this.escrowService.listAdminDisputes(
        {
          status,
          limit: limit
            ? Number(limit)
            : 100,
        },
      );

    return {
      success: true,
      data,
    };
  }

  @Get(
    'admin/disputes/:orderId',
  )
  @Permissions(
    'manage_disputes',
  )
  @ApiOperation({
    summary:
      'Consultar sala administrativa de uma disputa',
  })
  async getAdminDispute(
    @Param('orderId')
    orderId: string,
  ) {
    const data =
      await this.escrowService.getAdminDispute(
        orderId,
      );

    return {
      success: true,
      data,
    };
  }

  @Post(
    'admin/disputes/:orderId/messages',
  )
  @Permissions(
    'manage_disputes',
  )
  @ApiOperation({
    summary:
      'Adicionar mensagem à mediação de uma disputa',
  })
  async addAdminDisputeMessage(
    @Param('orderId')
    orderId: string,

    @Body()
    dto: AdminDisputeMessageDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      await this.escrowService.addAdminDisputeMessage(
        orderId,
        actorUserId,
        dto.message,
        dto.isPrivate === true,
      );

    return {
      success: true,
      data,
    };
  }

  @Post(
    'admin/disputes/:orderId/resolve',
  )
  @Permissions(
    'manage_disputes',
  )
  @ApiOperation({
    summary:
      'Resolver disputa administrativamente com movimentação real do Escrow',
  })
  async resolveAdminDispute(
    @Param('orderId')
    orderId: string,

    @Body()
    dto: AdminResolveDisputeDto,

    @Req()
    req: any,
  ) {
    const actorUserId =
      req.user?.id ||
      req.user?.userId ||
      null;

    const data =
      await this.escrowService.resolveDispute(
        orderId,
        dto.outcome,
        actorUserId,
        dto.note,
      );

    return {
      success: true,
      data,
    };
  }
}