import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskDetectionService } from './services/risk-detection.service';
import { RiskEventListener } from './listeners/risk-event.listener';

@Module({
  imports: [PrismaModule, AuditModule, PayoutsModule],
  controllers: [RiskController],
  providers: [RiskService, RiskDetectionService, RiskEventListener],
  exports: [RiskService, RiskDetectionService, RiskEventListener],
})
export class RiskModule {}
