-- CreateEnum
CREATE TYPE "HubZoneType" AS ENUM ('RECEIVING', 'STORAGE', 'PICKING', 'PACKING', 'SHIPPING', 'RETURNS', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "HubLocationStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'BLOCKED', 'RESERVED');

-- CreateEnum
CREATE TYPE "InboundShipmentStatus" AS ENUM ('CREATED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTING', 'STORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReceivingInspectionStatus" AS ENUM ('APPROVED', 'REJECTED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TransferOrderStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PICKING', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN "usedCapacity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN "primaryCurrencyId" TEXT,
ADD COLUMN "languagesJson" JSONB,
ADD COLUMN "operatingHoursJson" JSONB,
ADD COLUMN "usedWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN "maxWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN "usedVolume" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN "maxVolume" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "hub_zones" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "HubZoneType" NOT NULL DEFAULT 'STORAGE',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "usedCapacity" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "locationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_aisles" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_aisles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_racks" (
    "id" TEXT NOT NULL,
    "aisleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_shelves" (
    "id" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_locations" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "shelfId" TEXT,
    "code" TEXT NOT NULL,
    "status" "HubLocationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "capacity" INTEGER NOT NULL DEFAULT 100,
    "usedCapacity" INTEGER NOT NULL DEFAULT 0,
    "maxWeight" DECIMAL(12,3) NOT NULL DEFAULT 1000,
    "currentWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "maxVolume" DECIMAL(12,3) NOT NULL DEFAULT 10,
    "currentVolume" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_shipments" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "carrierName" TEXT,
    "trackingCode" TEXT,
    "status" "InboundShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "estimatedArrival" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "storedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "allocatedLocationId" TEXT,
    "unitWeight" DECIMAL(8,3),
    "unitVolume" DECIMAL(8,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_inspections" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "status" "ReceivingInspectionStatus" NOT NULL DEFAULT 'APPROVED',
    "inspectedQuantity" INTEGER NOT NULL,
    "passedQuantity" INTEGER NOT NULL,
    "failedQuantity" INTEGER NOT NULL DEFAULT 0,
    "weightRecorded" DECIMAL(12,3),
    "dimensionsRecordedJson" JSONB,
    "photosJson" JSONB,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_histories" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_orders" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "originWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "TransferOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "sourceLocationId" TEXT,
    "targetLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_histories" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_movements" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sourceLocationId" TEXT,
    "destinationLocationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "movedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_counts" (
    "id" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneId" TEXT,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'PLANNED',
    "assignedAuditorId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_items" (
    "id" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "systemQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "differenceQuantity" INTEGER,
    "recountQuantity" INTEGER,
    "adjustmentApplied" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_count_items_pkey" PRIMARY KEY ("id")
);

-- Unique & Performance Indexes
CREATE UNIQUE INDEX "hub_zones_warehouseId_code_key" ON "hub_zones"("warehouseId", "code");
CREATE INDEX "hub_zones_warehouseId_idx" ON "hub_zones"("warehouseId");

CREATE UNIQUE INDEX "hub_aisles_zoneId_code_key" ON "hub_aisles"("zoneId", "code");
CREATE INDEX "hub_aisles_zoneId_idx" ON "hub_aisles"("zoneId");

CREATE UNIQUE INDEX "hub_racks_aisleId_code_key" ON "hub_racks"("aisleId", "code");
CREATE INDEX "hub_racks_aisleId_idx" ON "hub_racks"("aisleId");

CREATE UNIQUE INDEX "hub_shelves_rackId_code_key" ON "hub_shelves"("rackId", "code");
CREATE INDEX "hub_shelves_rackId_idx" ON "hub_shelves"("rackId");

CREATE UNIQUE INDEX "hub_locations_code_key" ON "hub_locations"("code");
CREATE INDEX "hub_locations_warehouseId_idx" ON "hub_locations"("warehouseId");
CREATE INDEX "hub_locations_zoneId_idx" ON "hub_locations"("zoneId");
CREATE INDEX "hub_locations_status_idx" ON "hub_locations"("status");

CREATE UNIQUE INDEX "inbound_shipments_shipmentNumber_key" ON "inbound_shipments"("shipmentNumber");
CREATE INDEX "inbound_shipments_warehouseId_idx" ON "inbound_shipments"("warehouseId");
CREATE INDEX "inbound_shipments_status_idx" ON "inbound_shipments"("status");

CREATE INDEX "inbound_items_shipmentId_idx" ON "inbound_items"("shipmentId");
CREATE INDEX "inbound_items_variantId_idx" ON "inbound_items"("variantId");

CREATE INDEX "receiving_inspections_shipmentId_idx" ON "receiving_inspections"("shipmentId");
CREATE INDEX "receiving_inspections_itemId_idx" ON "receiving_inspections"("itemId");

CREATE INDEX "receiving_histories_shipmentId_idx" ON "receiving_histories"("shipmentId");

CREATE UNIQUE INDEX "transfer_orders_transferNumber_key" ON "transfer_orders"("transferNumber");
CREATE INDEX "transfer_orders_originWarehouseId_idx" ON "transfer_orders"("originWarehouseId");
CREATE INDEX "transfer_orders_destinationWarehouseId_idx" ON "transfer_orders"("destinationWarehouseId");
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders"("status");

CREATE INDEX "transfer_items_transferId_idx" ON "transfer_items"("transferId");
CREATE INDEX "transfer_items_variantId_idx" ON "transfer_items"("variantId");

CREATE INDEX "transfer_histories_transferId_idx" ON "transfer_histories"("transferId");

CREATE INDEX "warehouse_movements_warehouseId_idx" ON "warehouse_movements"("warehouseId");
CREATE INDEX "warehouse_movements_variantId_idx" ON "warehouse_movements"("variantId");

CREATE UNIQUE INDEX "cycle_counts_countNumber_key" ON "cycle_counts"("countNumber");
CREATE INDEX "cycle_counts_warehouseId_idx" ON "cycle_counts"("warehouseId");
CREATE INDEX "cycle_counts_status_idx" ON "cycle_counts"("status");

CREATE INDEX "cycle_count_items_cycleCountId_idx" ON "cycle_count_items"("cycleCountId");
CREATE INDEX "cycle_count_items_variantId_idx" ON "cycle_count_items"("variantId");
CREATE INDEX "cycle_count_items_locationId_idx" ON "cycle_count_items"("locationId");

-- Foreign Keys
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_primaryCurrencyId_fkey" FOREIGN KEY ("primaryCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hub_zones" ADD CONSTRAINT "hub_zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hub_aisles" ADD CONSTRAINT "hub_aisles_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "hub_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hub_racks" ADD CONSTRAINT "hub_racks_aisleId_fkey" FOREIGN KEY ("aisleId") REFERENCES "hub_aisles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hub_shelves" ADD CONSTRAINT "hub_shelves_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "hub_racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hub_locations" ADD CONSTRAINT "hub_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hub_locations" ADD CONSTRAINT "hub_locations_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "hub_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hub_locations" ADD CONSTRAINT "hub_locations_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "hub_shelves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inbound_shipments" ADD CONSTRAINT "inbound_shipments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_shipments" ADD CONSTRAINT "inbound_shipments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inbound_items" ADD CONSTRAINT "inbound_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "inbound_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_items" ADD CONSTRAINT "inbound_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inbound_items" ADD CONSTRAINT "inbound_items_allocatedLocationId_fkey" FOREIGN KEY ("allocatedLocationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "receiving_inspections" ADD CONSTRAINT "receiving_inspections_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "inbound_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receiving_inspections" ADD CONSTRAINT "receiving_inspections_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inbound_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receiving_inspections" ADD CONSTRAINT "receiving_inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receiving_histories" ADD CONSTRAINT "receiving_histories_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "inbound_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receiving_histories" ADD CONSTRAINT "receiving_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_originWarehouseId_fkey" FOREIGN KEY ("originWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_targetLocationId_fkey" FOREIGN KEY ("targetLocationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transfer_histories" ADD CONSTRAINT "transfer_histories_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transfer_histories" ADD CONSTRAINT "transfer_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "hub_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_assignedAuditorId_fkey" FOREIGN KEY ("assignedAuditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cycle_count_items" ADD CONSTRAINT "cycle_count_items_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "cycle_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_count_items" ADD CONSTRAINT "cycle_count_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_count_items" ADD CONSTRAINT "cycle_count_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "hub_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
