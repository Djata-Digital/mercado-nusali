import { Module } from '@nestjs/common';
import { PickingService } from './services/picking.service';
import { PackingService } from './services/packing.service';
import { LabelService } from './services/label.service';
import { ManifestService } from './services/manifest.service';
import { ShippingService } from './services/shipping.service';
import { PickingController } from './controllers/picking.controller';
import { PackingController } from './controllers/packing.controller';
import { ShippingController } from './controllers/shipping.controller';
import { ManifestsController } from './controllers/manifests.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    PickingController,
    PackingController,
    ShippingController,
    ManifestsController,
  ],
  providers: [
    PickingService,
    PackingService,
    LabelService,
    ManifestService,
    ShippingService,
  ],
  exports: [
    PickingService,
    PackingService,
    LabelService,
    ManifestService,
    ShippingService,
  ],
})
export class FulfillmentModule {}
