CREATE TYPE "SettlementBatchStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED', 'FAILED');
CREATE TYPE "SellerSettlementStatus" AS ENUM ('PENDING', 'READY', 'SETTLED', 'FAILED');

CREATE TABLE "SettlementBatch" (
  "id" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currencyId" TEXT NOT NULL,
  "status" "SettlementBatchStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerSettlement" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "currencyId" TEXT NOT NULL,
  "grossAmount" DECIMAL(20,4) NOT NULL,
  "platformFee" DECIMAL(20,4) NOT NULL,
  "adjustments" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "payoutAmount" DECIMAL(20,4) NOT NULL,
  "status" "SellerSettlementStatus" NOT NULL DEFAULT 'PENDING',
  "statementJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  CONSTRAINT "SellerSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementBatch_periodStart_periodEnd_currencyId_key"
ON "SettlementBatch"("periodStart", "periodEnd", "currencyId");

CREATE INDEX "SettlementBatch_status_createdAt_idx"
ON "SettlementBatch"("status", "createdAt");

CREATE UNIQUE INDEX "SellerSettlement_batchId_sellerId_key"
ON "SellerSettlement"("batchId", "sellerId");

CREATE INDEX "SellerSettlement_sellerId_status_idx"
ON "SellerSettlement"("sellerId", "status");

CREATE INDEX "SellerSettlement_batchId_status_idx"
ON "SellerSettlement"("batchId", "status");

ALTER TABLE "SellerSettlement"
ADD CONSTRAINT "SellerSettlement_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "SettlementBatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
