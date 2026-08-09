CREATE TYPE "SettlementAdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

CREATE TABLE "SettlementAdjustment" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "type" "SettlementAdjustmentType" NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementAdjustment_settlementId_createdAt_idx" ON "SettlementAdjustment"("settlementId", "createdAt");
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "SellerSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
