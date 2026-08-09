import { Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { DepositWalletDto, WithdrawWalletDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Wallet')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @Permissions('wallet:read:self')
  @ApiOperation({ summary: 'Consultar saldo da carteira do usuário autenticado' })
  async getBalance(@Req() req: any) {
    const data = await this.walletService.getWalletBalance(req.user.id);
    return { success: true, data };
  }

  @Get('transactions')
  @Permissions('wallet:read:self')
  @ApiOperation({ summary: 'Consultar histórico de transações da carteira' })
  async getTransactions(@Req() req: any, @Query('limit') limit?: number) {
    const data = await this.walletService.getTransactions(req.user.id, limit ? Number(limit) : 20);
    return { success: true, data };
  }

  @Post('deposit')
  @Permissions('wallet:deposit:self')
  @ApiOperation({ summary: 'Realizar depósito simulado na carteira' })
  async deposit(@Req() req: any, @Body() dto: DepositWalletDto) {
    const data = await this.walletService.deposit(req.user.id, dto.amount, dto.currencyId, dto.description);
    return { success: true, data };
  }

  @Post('withdraw')
  @Permissions('wallet:withdraw:self')
  @ApiOperation({ summary: 'Realizar saque da carteira' })
  async withdraw(@Req() req: any, @Body() dto: WithdrawWalletDto) {
    const data = await this.walletService.withdraw(req.user.id, dto.amount, dto.currencyId, dto.description);
    return { success: true, data };
  }
}
