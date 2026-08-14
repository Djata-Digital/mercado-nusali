-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'AUTHORIZED', 'REJECTED', 'IN_TRANSIT', 'RECEIVED_AT_HUB', 'INSPECTING', 'APPROVED', 'REFUND_PENDING', 'REFUNDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DEFECTIVE', 'DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'MISSING_PARTS', 'SIZE_OR_FIT', 'BUYER_CHANGED_MIND', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnInspectionDecision" AS ENUM ('APPROVED', 'PARTIALLY_APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "ReturnReason" NOT NULL,
    "reasonDetails" TEXT,
    "reverseTrackingCode" TEXT,
    "carrierId" TEXT,
    "returnWarehouseId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "inspectionDecision" "ReturnInspectionDecision",
    "inspectionNotes" TEXT,
    "refundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_histories" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "previousStatus" "ReturnStatus",
    "newStatus" "ReturnStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_returnNumber_key" ON "return_requests"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_reverseTrackingCode_key" ON "return_requests"("reverseTrackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_refundId_key" ON "return_requests"("refundId");

-- CreateIndex
CREATE INDEX "return_requests_orderId_idx" ON "return_requests"("orderId");

-- CreateIndex
CREATE INDEX "return_requests_buyerId_idx" ON "return_requests"("buyerId");

-- CreateIndex
CREATE INDEX "return_requests_sellerId_idx" ON "return_requests"("sellerId");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- CreateIndex
CREATE INDEX "return_requests_returnWarehouseId_idx" ON "return_requests"("returnWarehouseId");

-- CreateIndex
CREATE INDEX "return_items_orderItemId_idx" ON "return_items"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "return_items_returnRequestId_orderItemId_key" ON "return_items"("returnRequestId", "orderItemId");

-- CreateIndex
CREATE INDEX "return_histories_returnRequestId_idx" ON "return_histories"("returnRequestId");

-- CreateIndex
CREATE INDEX "return_histories_newStatus_idx" ON "return_histories"("newStatus");

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_returnWarehouseId_fkey" FOREIGN KEY ("returnWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_histories" ADD CONSTRAINT "return_histories_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_histories" ADD CONSTRAINT "return_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

