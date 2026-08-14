import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RefundsModule } from '../refunds/refunds.module';

import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [
    PrismaModule,
    RefundsModule,
  ],

  controllers: [
    ReturnsController,
  ],

  providers: [
    ReturnsService,
  ],

  exports: [
    ReturnsService,
  ],
})
export class ReturnsModule {}