-- CreateEnum
CREATE TYPE "TemporaryPodUploadStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'PROCESSING', 'PROMOTED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "carrier_webhook_events" ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "temporary_pod_uploads" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "TemporaryPodUploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "promotedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporary_pod_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "temporary_pod_uploads_fileKey_key" ON "temporary_pod_uploads"("fileKey");

-- CreateIndex
CREATE INDEX "temporary_pod_uploads_deliveryId_idx" ON "temporary_pod_uploads"("deliveryId");

-- CreateIndex
CREATE INDEX "temporary_pod_uploads_status_idx" ON "temporary_pod_uploads"("status");

-- CreateIndex
CREATE INDEX "temporary_pod_uploads_expiresAt_idx" ON "temporary_pod_uploads"("expiresAt");

-- AddForeignKey
ALTER TABLE "temporary_pod_uploads" ADD CONSTRAINT "temporary_pod_uploads_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_pod_uploads" ADD CONSTRAINT "temporary_pod_uploads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial Unique Indexes for Driver & Vehicle Active Exclusivity
CREATE UNIQUE INDEX IF NOT EXISTS delivery_active_driver_idx ON deliveries ("driverId") WHERE status IN ('DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY');
CREATE UNIQUE INDEX IF NOT EXISTS delivery_active_vehicle_idx ON deliveries ("vehicleId") WHERE status IN ('DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY');
CREATE UNIQUE INDEX IF NOT EXISTS delivery_route_active_driver_idx ON delivery_routes ("driverId") WHERE status IN ('PLANNED', 'ASSIGNED', 'IN_PROGRESS');
CREATE UNIQUE INDEX IF NOT EXISTS delivery_route_active_vehicle_idx ON delivery_routes ("vehicleId") WHERE status IN ('PLANNED', 'ASSIGNED', 'IN_PROGRESS');
CREATE UNIQUE INDEX IF NOT EXISTS driver_assignment_active_driver_idx ON driver_assignments ("driverId") WHERE status = 'ASSIGNED';
CREATE UNIQUE INDEX IF NOT EXISTS driver_assignment_active_vehicle_idx ON driver_assignments ("vehicleId") WHERE status = 'ASSIGNED';
