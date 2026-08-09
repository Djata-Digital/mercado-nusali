-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

-- CreateEnum
CREATE TYPE "CarrierType" AS ENUM ('NUSALI_INTERNAL', 'LOCAL_PARTNER', 'NATIONAL_CARRIER', 'INTERNATIONAL_CARRIER', 'POSTAL_SERVICE', 'AIR_CARGO', 'ROAD_CARGO', 'SEA_CARGO', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "CarrierStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CarrierEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('ROAD', 'AIR', 'SEA', 'RAIL', 'MOTORCYCLE', 'BICYCLE', 'PEDESTRIAN', 'MULTIMODAL');

-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('LABEL_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_ORIGIN_HUB', 'IN_TRANSIT', 'ARRIVED_AT_TRANSIT_HUB', 'DEPARTED_TRANSIT_HUB', 'ARRIVED_AT_DESTINATION_HUB', 'CUSTOMS_PENDING', 'CUSTOMS_CLEARED', 'CUSTOMS_HELD', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'DELIVERY_FAILED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'LOST', 'DAMAGED', 'CANCELLED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "TrackingEventSource" AS ENUM ('INTERNAL', 'CARRIER_WEBHOOK', 'CARRIER_POLLING', 'OPERATOR', 'DRIVER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CheckpointType" AS ENUM ('ORIGIN_HUB', 'TRANSIT_HUB', 'DESTINATION_HUB', 'BORDER', 'CUSTOMS', 'AIRPORT', 'PORT', 'DELIVERY_CENTER', 'PICKUP_POINT', 'CUSTOMER_ADDRESS');

-- CreateEnum
CREATE TYPE "CheckpointStatus" AS ENUM ('PLANNED', 'ARRIVED', 'DEPARTED', 'SKIPPED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'DRIVER_ASSIGNED', 'IN_PROGRESS', 'PICKED_UP', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('CREATED', 'SCHEDULED', 'DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY', 'ATTEMPTED', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNING', 'RETURNED');

-- CreateEnum
CREATE TYPE "ProofOfDeliveryMethod" AS ENUM ('DELIVERY_CODE', 'SIGNATURE', 'PHOTO', 'DOCUMENT', 'RECIPIENT_NAME', 'GEOLOCATION', 'QR_CODE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE', 'CAR', 'VAN', 'TRUCK', 'BICYCLE', 'BOAT', 'AIRCRAFT', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryRouteStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CarrierWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "LogisticsSlaType" AS ENUM ('PICKUP_DELAY', 'TRANSIT_DELAY', 'HUB_DELAY', 'CUSTOMS_DELAY', 'DELIVERY_DELAY');

-- CreateEnum
CREATE TYPE "LogisticsExceptionType" AS ENUM ('LOST', 'DAMAGED', 'ADDRESS_NOT_FOUND', 'RECIPIENT_ABSENT', 'REFUSED', 'WEATHER', 'VEHICLE_BREAKDOWN', 'CUSTOMS_HOLD', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "LogisticsExceptionStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "countryId" TEXT,
    "type" "CarrierType" NOT NULL DEFAULT 'LOCAL_PARTNER',
    "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
    "website" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "trackingUrlTemplate" TEXT,
    "supportsPickup" BOOLEAN NOT NULL DEFAULT true,
    "supportsDelivery" BOOLEAN NOT NULL DEFAULT true,
    "supportsInternational" BOOLEAN NOT NULL DEFAULT false,
    "supportsReturns" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_accounts" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "countryId" TEXT,
    "environment" "CarrierEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
    "credentialsEncryptedJson" JSONB NOT NULL,
    "webhookSecretEncrypted" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_services" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "TransportMode" NOT NULL DEFAULT 'ROAD',
    "estimatedMinDays" INTEGER NOT NULL DEFAULT 1,
    "estimatedMaxDays" INTEGER NOT NULL DEFAULT 5,
    "maxWeight" DECIMAL(12,3),
    "maxLength" DECIMAL(12,2),
    "maxWidth" DECIMAL(12,2),
    "maxHeight" DECIMAL(12,2),
    "supportsTracking" BOOLEAN NOT NULL DEFAULT true,
    "supportsInsurance" BOOLEAN NOT NULL DEFAULT false,
    "supportsCashOnDelivery" BOOLEAN NOT NULL DEFAULT false,
    "isInternational" BOOLEAN NOT NULL DEFAULT false,
    "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_service_zones" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "originCountryId" TEXT,
    "destCountryId" TEXT,
    "region" TEXT,
    "city" TEXT,
    "postalCodePattern" TEXT,
    "maxWeight" DECIMAL(12,3),
    "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_service_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trackings" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "externalTrackingNumber" TEXT,
    "currentStatus" "TrackingStatus" NOT NULL DEFAULT 'LABEL_CREATED',
    "originCountryId" TEXT,
    "destinationCountryId" TEXT,
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "isInternational" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trackings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "eventCode" TEXT NOT NULL,
    "status" "TrackingStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "countryId" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "hubId" TEXT,
    "carrierEventId" TEXT,
    "deduplicationKey" TEXT NOT NULL,
    "source" "TrackingEventSource" NOT NULL DEFAULT 'SYSTEM',
    "eventAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_checkpoints" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "CheckpointType" NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT,
    "region" TEXT,
    "city" TEXT,
    "hubId" TEXT,
    "plannedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "status" "CheckpointStatus" NOT NULL DEFAULT 'PLANNED',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_status_histories" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "previousStatus" "TrackingStatus",
    "newStatus" "TrackingStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_requests" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "timeWindowStart" TEXT,
    "timeWindowEnd" TEXT,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "status" "PickupStatus" NOT NULL DEFAULT 'REQUESTED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "pickupCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "pickup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_attempts" (
    "id" TEXT NOT NULL,
    "pickupRequestId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "driverId" TEXT,
    "status" "PickupStatus" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_histories" (
    "id" TEXT NOT NULL,
    "pickupRequestId" TEXT NOT NULL,
    "previousStatus" "PickupStatus",
    "newStatus" "PickupStatus" NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "addressSnapshotJson" JSONB NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhoneMasked" TEXT,
    "deliveryCodeHash" TEXT,
    "deliveryCodeSalt" TEXT,
    "deliveryCodeExpiresAt" TIMESTAMP(3),
    "deliveryCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryCodeMaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "deliveryCodeUsedAt" TIMESTAMP(3),
    "deliveryCodeChallengeId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'CREATED',
    "scheduledDate" TIMESTAMP(3),
    "timeWindowStart" TEXT,
    "timeWindowEnd" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "driverId" TEXT,
    "status" "DeliveryStatus" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "recipientName" TEXT,
    "signatureFileKey" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_histories" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "previousStatus" "DeliveryStatus",
    "newStatus" "DeliveryStatus" NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_deliveries" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "method" "ProofOfDeliveryMethod" NOT NULL DEFAULT 'DELIVERY_CODE',
    "recipientName" TEXT NOT NULL,
    "recipientDocumentMasked" TEXT,
    "deliveryCodeVerified" BOOLEAN NOT NULL DEFAULT false,
    "signatureFileKey" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "deliveredById" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_delivery_files" (
    "id" TEXT NOT NULL,
    "proofOfDeliveryId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_delivery_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_delivery_histories" (
    "id" TEXT NOT NULL,
    "proofOfDeliveryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_delivery_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_drivers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "licenseNumber" TEXT NOT NULL,
    "licenseCategory" TEXT NOT NULL,
    "licenseExpiresAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "emergencyPhone" TEXT,
    "countryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_vehicles" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'VAN',
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "maxWeight" DECIMAL(12,3) NOT NULL,
    "maxVolume" DECIMAL(12,3) NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentDriverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_assignments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_routes" (
    "id" TEXT NOT NULL,
    "routeNumber" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryRouteStatus" NOT NULL DEFAULT 'PLANNED',
    "totalStops" INTEGER NOT NULL DEFAULT 0,
    "totalDistanceEstimated" DECIMAL(10,2),
    "totalDurationEstimated" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_route_stops" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "CheckpointStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedArrivalAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_route_histories" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "previousStatus" "DeliveryRouteStatus",
    "newStatus" "DeliveryRouteStatus" NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_route_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_webhook_events" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "externalEventId" TEXT,
    "trackingNumber" TEXT,
    "signatureHash" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "headersJsonSanitized" JSONB NOT NULL,
    "status" "CarrierWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_sla_events" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "type" "LogisticsSlaType" NOT NULL,
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_sla_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_exceptions" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT,
    "trackingId" TEXT,
    "type" "LogisticsExceptionType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" "LogisticsExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedById" TEXT,
    "assignedToId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carriers_code_key" ON "carriers"("code");

-- CreateIndex
CREATE INDEX "carriers_status_idx" ON "carriers"("status");

-- CreateIndex
CREATE INDEX "carriers_type_idx" ON "carriers"("type");

-- CreateIndex
CREATE INDEX "carrier_accounts_carrierId_idx" ON "carrier_accounts"("carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_services_carrierId_serviceCode_key" ON "carrier_services"("carrierId", "serviceCode");

-- CreateIndex
CREATE INDEX "carrier_service_zones_serviceId_idx" ON "carrier_service_zones"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "trackings_trackingNumber_key" ON "trackings"("trackingNumber");

-- CreateIndex
CREATE INDEX "trackings_shipmentId_idx" ON "trackings"("shipmentId");

-- CreateIndex
CREATE INDEX "trackings_carrierId_idx" ON "trackings"("carrierId");

-- CreateIndex
CREATE INDEX "trackings_currentStatus_idx" ON "trackings"("currentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_events_deduplicationKey_key" ON "tracking_events"("deduplicationKey");

-- CreateIndex
CREATE INDEX "tracking_events_trackingId_idx" ON "tracking_events"("trackingId");

-- CreateIndex
CREATE INDEX "tracking_events_status_idx" ON "tracking_events"("status");

-- CreateIndex
CREATE INDEX "tracking_events_eventAt_idx" ON "tracking_events"("eventAt");

-- CreateIndex
CREATE INDEX "tracking_checkpoints_trackingId_sequence_idx" ON "tracking_checkpoints"("trackingId", "sequence");

-- CreateIndex
CREATE INDEX "tracking_status_histories_trackingId_idx" ON "tracking_status_histories"("trackingId");

-- CreateIndex
CREATE INDEX "pickup_requests_shipmentId_idx" ON "pickup_requests"("shipmentId");

-- CreateIndex
CREATE INDEX "pickup_requests_carrierId_idx" ON "pickup_requests"("carrierId");

-- CreateIndex
CREATE INDEX "pickup_requests_warehouseId_idx" ON "pickup_requests"("warehouseId");

-- CreateIndex
CREATE INDEX "pickup_requests_status_idx" ON "pickup_requests"("status");

-- CreateIndex
CREATE INDEX "pickup_attempts_pickupRequestId_idx" ON "pickup_attempts"("pickupRequestId");

-- CreateIndex
CREATE INDEX "pickup_histories_pickupRequestId_idx" ON "pickup_histories"("pickupRequestId");

-- CreateIndex
CREATE INDEX "deliveries_shipmentId_idx" ON "deliveries"("shipmentId");

-- CreateIndex
CREATE INDEX "deliveries_trackingId_idx" ON "deliveries"("trackingId");

-- CreateIndex
CREATE INDEX "deliveries_carrierId_idx" ON "deliveries"("carrierId");

-- CreateIndex
CREATE INDEX "deliveries_driverId_idx" ON "deliveries"("driverId");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "delivery_attempts_deliveryId_idx" ON "delivery_attempts"("deliveryId");

-- CreateIndex
CREATE INDEX "delivery_histories_deliveryId_idx" ON "delivery_histories"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_deliveryId_key" ON "proof_of_deliveries"("deliveryId");

-- CreateIndex
CREATE INDEX "proof_of_delivery_files_proofOfDeliveryId_idx" ON "proof_of_delivery_files"("proofOfDeliveryId");

-- CreateIndex
CREATE INDEX "proof_of_delivery_histories_proofOfDeliveryId_idx" ON "proof_of_delivery_histories"("proofOfDeliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_drivers_userId_key" ON "logistics_drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_drivers_licenseNumber_key" ON "logistics_drivers"("licenseNumber");

-- CreateIndex
CREATE INDEX "logistics_drivers_carrierId_idx" ON "logistics_drivers"("carrierId");

-- CreateIndex
CREATE INDEX "logistics_drivers_status_idx" ON "logistics_drivers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_vehicles_plate_key" ON "logistics_vehicles"("plate");

-- CreateIndex
CREATE INDEX "logistics_vehicles_carrierId_idx" ON "logistics_vehicles"("carrierId");

-- CreateIndex
CREATE INDEX "logistics_vehicles_status_idx" ON "logistics_vehicles"("status");

-- CreateIndex
CREATE INDEX "driver_assignments_driverId_idx" ON "driver_assignments"("driverId");

-- CreateIndex
CREATE INDEX "driver_assignments_vehicleId_idx" ON "driver_assignments"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_routes_routeNumber_key" ON "delivery_routes"("routeNumber");

-- CreateIndex
CREATE INDEX "delivery_routes_carrierId_idx" ON "delivery_routes"("carrierId");

-- CreateIndex
CREATE INDEX "delivery_routes_warehouseId_idx" ON "delivery_routes"("warehouseId");

-- CreateIndex
CREATE INDEX "delivery_routes_driverId_idx" ON "delivery_routes"("driverId");

-- CreateIndex
CREATE INDEX "delivery_routes_status_idx" ON "delivery_routes"("status");

-- CreateIndex
CREATE INDEX "delivery_route_stops_routeId_sequence_idx" ON "delivery_route_stops"("routeId", "sequence");

-- CreateIndex
CREATE INDEX "delivery_route_stops_deliveryId_idx" ON "delivery_route_stops"("deliveryId");

-- CreateIndex
CREATE INDEX "delivery_route_histories_routeId_idx" ON "delivery_route_histories"("routeId");

-- CreateIndex
CREATE INDEX "carrier_webhook_events_carrierId_idx" ON "carrier_webhook_events"("carrierId");

-- CreateIndex
CREATE INDEX "carrier_webhook_events_status_idx" ON "carrier_webhook_events"("status");

-- CreateIndex
CREATE INDEX "carrier_webhook_events_trackingNumber_idx" ON "carrier_webhook_events"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_webhook_events_carrierId_signatureHash_key" ON "carrier_webhook_events"("carrierId", "signatureHash");

-- CreateIndex
CREATE INDEX "logistics_sla_events_trackingId_idx" ON "logistics_sla_events"("trackingId");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_sla_events_trackingId_type_key" ON "logistics_sla_events"("trackingId", "type");

-- CreateIndex
CREATE INDEX "logistics_exceptions_shipmentId_idx" ON "logistics_exceptions"("shipmentId");

-- CreateIndex
CREATE INDEX "logistics_exceptions_trackingId_idx" ON "logistics_exceptions"("trackingId");

-- CreateIndex
CREATE INDEX "logistics_exceptions_status_idx" ON "logistics_exceptions"("status");

-- AddForeignKey
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_accounts" ADD CONSTRAINT "carrier_accounts_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_accounts" ADD CONSTRAINT "carrier_accounts_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_services" ADD CONSTRAINT "carrier_services_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_service_zones" ADD CONSTRAINT "carrier_service_zones_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "carrier_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_service_zones" ADD CONSTRAINT "carrier_service_zones_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_service_zones" ADD CONSTRAINT "carrier_service_zones_destCountryId_fkey" FOREIGN KEY ("destCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trackings" ADD CONSTRAINT "trackings_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trackings" ADD CONSTRAINT "trackings_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trackings" ADD CONSTRAINT "trackings_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trackings" ADD CONSTRAINT "trackings_destinationCountryId_fkey" FOREIGN KEY ("destinationCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_checkpoints" ADD CONSTRAINT "tracking_checkpoints_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_checkpoints" ADD CONSTRAINT "tracking_checkpoints_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_checkpoints" ADD CONSTRAINT "tracking_checkpoints_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_status_histories" ADD CONSTRAINT "tracking_status_histories_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_status_histories" ADD CONSTRAINT "tracking_status_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "logistics_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "logistics_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_pickupRequestId_fkey" FOREIGN KEY ("pickupRequestId") REFERENCES "pickup_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "logistics_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_histories" ADD CONSTRAINT "pickup_histories_pickupRequestId_fkey" FOREIGN KEY ("pickupRequestId") REFERENCES "pickup_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_histories" ADD CONSTRAINT "pickup_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trackings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "logistics_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "logistics_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "logistics_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_histories" ADD CONSTRAINT "delivery_histories_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_histories" ADD CONSTRAINT "delivery_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery_files" ADD CONSTRAINT "proof_of_delivery_files_proofOfDeliveryId_fkey" FOREIGN KEY ("proofOfDeliveryId") REFERENCES "proof_of_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery_histories" ADD CONSTRAINT "proof_of_delivery_histories_proofOfDeliveryId_fkey" FOREIGN KEY ("proofOfDeliveryId") REFERENCES "proof_of_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery_histories" ADD CONSTRAINT "proof_of_delivery_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "logistics_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "logistics_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "logistics_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "logistics_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "logistics_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_route_stops" ADD CONSTRAINT "delivery_route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "delivery_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_route_stops" ADD CONSTRAINT "delivery_route_stops_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_route_histories" ADD CONSTRAINT "delivery_route_histories_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "delivery_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_route_histories" ADD CONSTRAINT "delivery_route_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_webhook_events" ADD CONSTRAINT "carrier_webhook_events_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_sla_events" ADD CONSTRAINT "logistics_sla_events_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_exceptions" ADD CONSTRAINT "logistics_exceptions_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_exceptions" ADD CONSTRAINT "logistics_exceptions_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_exceptions" ADD CONSTRAINT "logistics_exceptions_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_exceptions" ADD CONSTRAINT "logistics_exceptions_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: Maximum 1 active Tracking per Shipment
CREATE UNIQUE INDEX "tracking_active_shipment_idx"
ON "trackings" ("shipmentId")
WHERE "currentStatus" NOT IN ('DELIVERED', 'RETURNED', 'LOST', 'CANCELLED');

-- Partial unique index: Maximum 1 active Delivery per Shipment
CREATE UNIQUE INDEX "delivery_active_shipment_idx"
ON "deliveries" ("shipmentId")
WHERE "status" NOT IN ('DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED');

-- Partial unique index: Maximum 1 active association of Delivery in non-terminal routes
CREATE UNIQUE INDEX "delivery_route_stop_active_delivery_idx"
ON "delivery_route_stops" ("deliveryId")
WHERE "status" NOT IN ('DEPARTED', 'CANCELLED', 'SKIPPED');


