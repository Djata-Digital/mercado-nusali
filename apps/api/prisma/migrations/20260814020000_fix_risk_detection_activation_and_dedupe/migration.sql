-- AlterTable
ALTER TABLE "risk_alerts" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE INDEX "risk_alerts_dedupeKey_idx" ON "risk_alerts"("dedupeKey");

-- CreatePartialUniqueIndex
CREATE UNIQUE INDEX "risk_alerts_active_dedupe_key" ON "risk_alerts"("dedupeKey")
WHERE "status" IN ('OPEN', 'INVESTIGATING', 'BLOCKED', 'MONITORING');
