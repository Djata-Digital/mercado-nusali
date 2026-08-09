import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletTransactionService } from './services/wallet-transaction.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [WalletController],
  providers: [WalletService, WalletTransactionService],
  exports: [WalletService, WalletTransactionService],
})
export class WalletModule {}
