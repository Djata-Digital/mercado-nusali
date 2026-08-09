-- CreateEnum
CREATE TYPE "PickingOrderStatus" AS ENUM ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PICKED', 'PARTIALLY_PICKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickingBatchType" AS ENUM ('SINGLE_ORDER', 'BATCH', 'WAVE');

-- CreateEnum
CREATE TYPE "PickingBatchStatus" AS ENUM ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackingOrderStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'PACKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackingMaterialType" AS ENUM ('BOX', 'ENVELOPE', 'BAG', 'PALLET', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PackingMaterialStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'READY_TO_SHIP', 'DISPATCHED', 'WAITING_CARRIER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('CREATED', 'CLOSED', 'DISPATCHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "picking_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "PickingBatchType" NOT NULL DEFAULT 'SINGLE_ORDER',
    "status" "PickingBatchStatus" NOT NULL DEFAULT 'CREATED',
    "assignedOperatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_orders" (
    "id" TEXT NOT NULL,
    "pickingNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" "PickingOrderStatus" NOT NULL DEFAULT 'CREATED',
    "assignedOperatorId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_items" (
    "id" TEXT NOT NULL,
    "pickingOrderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT,
    "expectedQuantity" INTEGER NOT NULL,
    "pickedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "PickingOrderStatus" NOT NULL DEFAULT 'CREATED',
    "operatorId" TEXT,
    "pickedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_histories" (
    "id" TEXT NOT NULL,
    "pickingOrderId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "picking_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PackingMaterialType" NOT NULL DEFAULT 'BOX',
    "ownWeight" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "maxWeight" DECIMAL(8,3) NOT NULL DEFAULT 1000,
    "width" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "height" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "length" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "volume" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "status" "PackingMaterialStatus" NOT NULL DEFAULT 'ACTIVE',
    "stockQuantity" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_orders" (
    "id" TEXT NOT NULL,
    "packingNumber" TEXT NOT NULL,
    "pickingOrderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "materialId" TEXT,
    "status" "PackingOrderStatus" NOT NULL DEFAULT 'CREATED',
    "operatorId" TEXT,
    "grossWeight" DECIMAL(12,3),
    "netWeight" DECIMAL(12,3),
    "width" DECIMAL(8,2),
    "height" DECIMAL(8,2),
    "length" DECIMAL(8,2),
    "volumetricWeight" DECIMAL(12,3),
    "sealCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_items" (
    "id" TEXT NOT NULL,
    "packingOrderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_histories" (
    "id" TEXT NOT NULL,
    "packingOrderId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_labels" (
    "id" TEXT NOT NULL,
    "labelNumber" TEXT NOT NULL,
    "packingOrderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "qrCodeData" TEXT NOT NULL,
    "barcodeData" TEXT NOT NULL,
    "internalCode" TEXT NOT NULL,
    "carrierName" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientAddressJson" JSONB NOT NULL,
    "printedAt" TIMESTAMP(3),
    "reprintCount" INTEGER NOT NULL DEFAULT 0,
    "isInvalidated" BOOLEAN NOT NULL DEFAULT false,
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_label_histories" (
    "id" TEXT NOT NULL,
    "shippingLabelId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "printedById" TEXT,
    "reprintReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_label_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_manifests" (
    "id" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'CREATED',
    "driverName" TEXT,
    "driverDocument" TEXT,
    "vehiclePlate" TEXT,
    "carrierName" TEXT,
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "totalWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_manifest_items" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_manifest_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "shipmentCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "packingOrderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "manifestId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_packages" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "packingOrderId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "dimensionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_histories" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "notes" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "picking_batches_batchNumber_key" ON "picking_batches"("batchNumber");
CREATE INDEX "picking_batches_warehouseId_idx" ON "picking_batches"("warehouseId");
CREATE INDEX "picking_batches_status_idx" ON "picking_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "picking_orders_pickingNumber_key" ON "picking_orders"("pickingNumber");
CREATE INDEX "picking_orders_orderId_idx" ON "picking_orders"("orderId");
CREATE INDEX "picking_orders_warehouseId_idx" ON "picking_orders"("warehouseId");
CREATE INDEX "picking_orders_batchId_idx" ON "picking_orders"("batchId");
CREATE INDEX "picking_orders_status_idx" ON "picking_orders"("status");

-- CreateIndex
CREATE INDEX "picking_items_pickingOrderId_idx" ON "picking_items"("pickingOrderId");
CREATE INDEX "picking_items_variantId_idx" ON "picking_items"("variantId");
CREATE INDEX "picking_items_locationId_idx" ON "picking_items"("locationId");

-- CreateIndex
CREATE INDEX "picking_histories_pickingOrderId_idx" ON "picking_histories"("pickingOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "packing_materials_code_key" ON "packing_materials"("code");

-- CreateIndex
CREATE UNIQUE INDEX "packing_orders_packingNumber_key" ON "packing_orders"("packingNumber");
CREATE UNIQUE INDEX "packing_orders_pickingOrderId_key" ON "packing_orders"("pickingOrderId");
CREATE INDEX "packing_orders_orderId_idx" ON "packing_orders"("orderId");
CREATE INDEX "packing_orders_warehouseId_idx" ON "packing_orders"("warehouseId");
CREATE INDEX "packing_orders_status_idx" ON "packing_orders"("status");

-- CreateIndex
CREATE INDEX "packing_items_packingOrderId_idx" ON "packing_items"("packingOrderId");
CREATE INDEX "packing_items_variantId_idx" ON "packing_items"("variantId");

-- CreateIndex
CREATE INDEX "packing_histories_packingOrderId_idx" ON "packing_histories"("packingOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_labels_labelNumber_key" ON "shipping_labels"("labelNumber");
CREATE UNIQUE INDEX "shipping_labels_packingOrderId_key" ON "shipping_labels"("packingOrderId");
CREATE UNIQUE INDEX "shipping_labels_trackingNumber_key" ON "shipping_labels"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipping_label_histories_shippingLabelId_idx" ON "shipping_label_histories"("shippingLabelId");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_manifests_manifestNumber_key" ON "shipping_manifests"("manifestNumber");
CREATE INDEX "shipping_manifests_warehouseId_idx" ON "shipping_manifests"("warehouseId");
CREATE INDEX "shipping_manifests_status_idx" ON "shipping_manifests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_manifest_items_manifestId_shipmentId_key" ON "shipping_manifest_items"("manifestId", "shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipmentCode_key" ON "shipments"("shipmentCode");
CREATE UNIQUE INDEX "shipments_packingOrderId_key" ON "shipments"("packingOrderId");
CREATE INDEX "shipments_orderId_idx" ON "shipments"("orderId");
CREATE INDEX "shipments_warehouseId_idx" ON "shipments"("warehouseId");
CREATE INDEX "shipments_manifestId_idx" ON "shipments"("manifestId");
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_packages_packingOrderId_key" ON "shipment_packages"("packingOrderId");
CREATE INDEX "shipment_packages_shipmentId_idx" ON "shipment_packages"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_histories_shipmentId_idx" ON "shipment_histories"("shipmentId");

-- AddForeignKey
ALTER TABLE "picking_batches" ADD CONSTRAINT "picking_batches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "picking_batches" ADD CONSTRAINT "picking_batches_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_orders" ADD CONSTRAINT "picking_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "picking_orders" ADD CONSTRAINT "picking_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "picking_orders" ADD CONSTRAINT "picking_orders_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "picking_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "picking_orders" ADD CONSTRAINT "picking_orders_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_items" ADD CONSTRAINT "picking_items_pickingOrderId_fkey" FOREIGN KEY ("pickingOrderId") REFERENCES "picking_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "picking_items" ADD CONSTRAINT "picking_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "picking_items" ADD CONSTRAINT "picking_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "picking_items" ADD CONSTRAINT "picking_items_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_histories" ADD CONSTRAINT "picking_histories_pickingOrderId_fkey" FOREIGN KEY ("pickingOrderId") REFERENCES "picking_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "picking_histories" ADD CONSTRAINT "picking_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_pickingOrderId_fkey" FOREIGN KEY ("pickingOrderId") REFERENCES "picking_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "packing_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_items" ADD CONSTRAINT "packing_items_packingOrderId_fkey" FOREIGN KEY ("packingOrderId") REFERENCES "packing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "packing_items" ADD CONSTRAINT "packing_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_histories" ADD CONSTRAINT "packing_histories_packingOrderId_fkey" FOREIGN KEY ("packingOrderId") REFERENCES "packing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "packing_histories" ADD CONSTRAINT "packing_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_labels" ADD CONSTRAINT "shipping_labels_packingOrderId_fkey" FOREIGN KEY ("packingOrderId") REFERENCES "packing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_label_histories" ADD CONSTRAINT "shipping_label_histories_shippingLabelId_fkey" FOREIGN KEY ("shippingLabelId") REFERENCES "shipping_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_label_histories" ADD CONSTRAINT "shipping_label_histories_printedById_fkey" FOREIGN KEY ("printedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_manifests" ADD CONSTRAINT "shipping_manifests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_manifests" ADD CONSTRAINT "shipping_manifests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_manifest_items" ADD CONSTRAINT "shipping_manifest_items_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "shipping_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_manifest_items" ADD CONSTRAINT "shipping_manifest_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_packingOrderId_fkey" FOREIGN KEY ("packingOrderId") REFERENCES "packing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "shipping_manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_packages" ADD CONSTRAINT "shipment_packages_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_packages" ADD CONSTRAINT "shipment_packages_packingOrderId_fkey" FOREIGN KEY ("packingOrderId") REFERENCES "packing_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_histories" ADD CONSTRAINT "shipment_histories_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_histories" ADD CONSTRAINT "shipment_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
