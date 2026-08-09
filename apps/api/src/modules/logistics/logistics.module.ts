import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SecretsEncryptionService } from './security/secrets-encryption.service';
import { DeliveryCodeService } from './security/delivery-code.service';
import {
  ConsoleDeliveryCodeProvider,
  DeliveryCodeNotificationService,
} from './security/delivery-code-notification.provider';
import { NusaliInternalCarrierProvider } from './providers/nusali-internal-carrier.provider';
import { GenericLocalCarrierProvider } from './providers/generic-local-carrier.provider';
import {
  DhlCarrierProvider,
  UpsCarrierProvider,
  FedexCarrierProvider,
  PostalCarrierProvider,
} from './providers/external-unconfigured.providers';
import { CarrierProviderFactory } from './providers/carrier-provider.factory';
import { CarrierService } from './carriers/carrier.service';
import { CarrierController } from './carriers/carrier.controller';
import { TrackingStateMachineService } from './tracking/tracking-state-machine.service';
import { TrackingService } from './tracking/tracking.service';
import { TrackingController } from './tracking/tracking.controller';
import { ProofOfDeliveryService } from './deliveries/proof-of-delivery.service';
import { DeliveryService } from './deliveries/delivery.service';
import { DeliveryController } from './deliveries/delivery.controller';
import { DeliveryRouteService, RouteOptimizationProvider } from './routes/delivery-route.service';
import { LogisticsController } from './routes/logistics.controller';
import { LogisticsDriverService } from './resources/logistics-driver.service';
import { LogisticsVehicleService } from './resources/logistics-vehicle.service';
import { PickupService } from './pickups/pickup.service';
import { PickupController } from './pickups/pickup.controller';
import { CarrierWebhookService } from './webhooks/carrier-webhook.service';
import { CarrierWebhookController } from './webhooks/carrier-webhook.controller';
import { CarrierWebhookProcessor } from './webhooks/carrier-webhook.processor';
import { LogisticsSlaService } from './exceptions/logistics-sla.service';
import { LogisticsExceptionService } from './exceptions/logistics-exception.service';

import { HubsController } from './controllers/hubs.controller';
import { InboundController } from './controllers/inbound.controller';
import { TransfersController } from './controllers/transfers.controller';
import { WarehouseOperationsController } from './controllers/warehouse-operations.controller';
import { HubsService } from './services/hubs.service';
import { InboundService } from './services/inbound.service';
import { LocationAllocationService } from './services/location-allocation.service';
import { TransfersService } from './services/transfers.service';
import { WarehouseOperationsService } from './services/warehouse-operations.service';

import { PodCleanupProcessor } from './deliveries/pod-cleanup.processor';

const bullMqWorkersEnabled = process.env.DISABLE_BULLMQ_WORKERS !== 'true';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    ...(bullMqWorkersEnabled
      ? [
          BullModule.registerQueue(
            { name: 'carrier-webhook-processing' },
            { name: 'pod-cleanup' },
          ),
        ]
      : []),
  ],
  controllers: [
    HubsController,
    InboundController,
    TransfersController,
    WarehouseOperationsController,
    CarrierController,
    TrackingController,
    DeliveryController,
    LogisticsController,
    PickupController,
    CarrierWebhookController,
  ],
  providers: [
    HubsService,
    InboundService,
    LocationAllocationService,
    TransfersService,
    WarehouseOperationsService,
    SecretsEncryptionService,
    DeliveryCodeService,
    ConsoleDeliveryCodeProvider,
    DeliveryCodeNotificationService,
    NusaliInternalCarrierProvider,
    GenericLocalCarrierProvider,
    DhlCarrierProvider,
    UpsCarrierProvider,
    FedexCarrierProvider,
    PostalCarrierProvider,
    CarrierProviderFactory,
    CarrierService,
    TrackingStateMachineService,
    TrackingService,
    ProofOfDeliveryService,
    ...(bullMqWorkersEnabled ? [PodCleanupProcessor] : []),
    DeliveryService,
    RouteOptimizationProvider,
    DeliveryRouteService,
    LogisticsDriverService,
    LogisticsVehicleService,
    PickupService,
    CarrierWebhookService,
    ...(bullMqWorkersEnabled ? [CarrierWebhookProcessor] : []),
    LogisticsSlaService,
    LogisticsExceptionService,
  ],
  exports: [
    HubsService,
    InboundService,
    LocationAllocationService,
    TransfersService,
    WarehouseOperationsService,
    CarrierService,
    TrackingService,
    TrackingStateMachineService,
    DeliveryService,
    ProofOfDeliveryService,
    DeliveryRouteService,
    LogisticsDriverService,
    LogisticsVehicleService,
    PickupService,
    CarrierWebhookService,
    CarrierProviderFactory,
  ],
})
export class LogisticsModule {}

