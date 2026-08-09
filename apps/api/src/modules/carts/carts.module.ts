import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { AuditModule } from '../audit/audit.module';
import { InventoryAvailabilityModule } from '../inventory-availability/inventory-availability.module';

@Module({
  imports: [AuditModule, InventoryAvailabilityModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
