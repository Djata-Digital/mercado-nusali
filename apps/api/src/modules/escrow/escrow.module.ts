import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WalletModule } from '../wallet/wallet.module';
import { EscrowTransactionService } from './services/escrow-transaction.service';
import { EscrowStateMachineService } from './services/escrow-state-machine.service';
import { EscrowEventsService } from './services/escrow-events.service';
import { EscrowReleasePolicyService } from './services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from './services/escrow-refund-policy.service';
import { EscrowDisputePolicyService } from './services/escrow-dispute-policy.service';

@Module({
  imports: [PrismaModule, LedgerModule, OutboxModule, WalletModule],
  controllers: [EscrowController],
  providers: [
    EscrowService,
    EscrowTransactionService,
    EscrowStateMachineService,
    EscrowEventsService,
    EscrowReleasePolicyService,
    EscrowRefundPolicyService,
    EscrowDisputePolicyService,
  ],
  exports: [
    EscrowService,
    EscrowTransactionService,
    EscrowStateMachineService,
    EscrowEventsService,
    EscrowReleasePolicyService,
    EscrowRefundPolicyService,
    EscrowDisputePolicyService,
  ],
})
export class EscrowModule {}
