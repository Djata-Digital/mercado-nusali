import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { PayoutEventsService } from './services/payout-events.service';
import { PayoutReconciliationService } from './services/payout-reconciliation.service';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [PayoutsController],
  providers: [
    PayoutsService,
    PayoutEventsService,
    PayoutReconciliationService,
  ],
  exports: [PayoutsService, PayoutReconciliationService],
})
export class PayoutsModule {}
