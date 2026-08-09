ALTER TYPE "SellerSettlementStatus"
ADD VALUE IF NOT EXISTS 'PAYOUT_PENDING' AFTER 'READY';

ALTER TABLE "SellerSettlement"
ADD COLUMN "payoutId" TEXT,
ADD COLUMN "payoutRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SellerSettlement_payoutId_key"
ON "SellerSettlement"("payoutId");

ALTER TABLE "SellerSettlement"
ADD CONSTRAINT "SellerSettlement_payoutId_fkey"
FOREIGN KEY ("payoutId")
REFERENCES "payouts"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
