import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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

import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequestPayoutDto } from './dto/payout.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('Payouts')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @Permissions('payout:read:self')
  async listSellerPayouts(@Req() req: any) {
    return {
      success: true,
      data: await this.payoutsService.listSellerPayouts(req.user.id),
    };
  }

  @Get('admin/all')
  @Permissions('payout:process:admin')
  @ApiOperation({
    summary:
      'Listar payouts globalmente para administração financeira',
  })
  async listAdminPayouts(
    @Query('status')
    status?: string,

    @Query('sellerId')
    sellerId?: string,

    @Query('limit')
    limit?: string,
  ) {
    return {
      success: true,

      data:
        await this.payoutsService.listAdminPayouts(
          {
            status:
              status ||
              undefined,

            sellerId:
              sellerId ||
              undefined,

            limit: limit
              ? Number(limit)
              : undefined,
          },
        ),
    };
  }

  @Post('request')
  @Permissions('payout:request:manage')
  async requestPayout(@Req() req: any, @Body() dto: RequestPayoutDto) {
    return {
      success: true,
      data: await this.payoutsService.requestPayout(
        req.user.id,
        dto.amount,
        dto.currencyId,
        dto.payoutMethod,
      ),
    };
  }

  @Post(':id/process')
  @Permissions('payout:process:admin')
  async processPayout(@Param('id') payoutId: string) {
    return {
      success: true,
      data: await this.payoutsService.processPayout(payoutId),
    };
  }

  @Post(':id/cancel')
  @Permissions('payout:request:manage')
  async cancelPayout(@Req() req: any, @Param('id') payoutId: string) {
    return {
      success: true,
      data: await this.payoutsService.cancelPayout(req.user.id, payoutId),
    };
  }

  @Post(':id/fail')
  @Permissions('payout:process:admin')
  async failPayout(
    @Param('id') payoutId: string,
    @Body() body: { reason?: string },
  ) {
    return {
      success: true,
      data: await this.payoutsService.failPayout(
        payoutId,
        body?.reason,
      ),
    };
  }

  @Get(':id/reconciliation')
  @Permissions('payout:process:admin')
  @ApiOperation({ summary: 'Reconciliar um payout com Wallet e Ledger' })
  async reconcile(@Param('id') payoutId: string) {
    return {
      success: true,
      data: await this.payoutsService.reconcilePayout(payoutId),
    };
  }

  @Get('admin/reconciliation/issues')
  @Permissions('payout:process:admin')
  async listIssues(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return {
      success: true,
      data: await this.payoutsService.listReconciliationIssues(parsed),
    };
  }
}
