import { Module } from '@nestjs/common';
import { InventoryAvailabilityService } from './inventory-availability.service';

@Module({
  providers: [InventoryAvailabilityService],
  exports: [InventoryAvailabilityService],
})
export class InventoryAvailabilityModule {}
