-- CreateEnum
CREATE TYPE "RiskAlertType" AS ENUM ('SUSPICIOUS_PAYMENT', 'MULTIPLE_ACCOUNTS', 'DOCUMENT_INCONSISTENCY', 'HIGH_RISK_PAYOUT', 'NEW_SELLER_HIGH_VOLUME', 'CHARGEBACK', 'SUSPICIOUS_ADDRESS', 'LOGISTICS_FRAUD', 'COUNTERFEIT_SUSPECTED', 'PAYOUT_RECONCILIATION', 'ACCOUNT_TAKEOVER', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskAlertStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'BLOCKED', 'RELEASED', 'MONITORING', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskEntityType" AS ENUM ('USER', 'SELLER', 'STORE', 'ORDER', 'PAYMENT', 'PAYOUT', 'PRODUCT', 'SHIPMENT');

-- CreateTable
CREATE TABLE "risk_alerts" (
    "id" TEXT NOT NULL,
    "type" "RiskAlertType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "status" "RiskAlertStatus" NOT NULL DEFAULT 'OPEN',
    "riskScore" INTEGER NOT NULL,
    "entityType" "RiskEntityType" NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "sellerId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "payoutId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "country" TEXT,
    "source" TEXT,
    "ruleCode" TEXT,
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_alert_histories" (
    "id" TEXT NOT NULL,
    "riskAlertId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "oldStatus" "RiskAlertStatus",
    "newStatus" "RiskAlertStatus",
    "performedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_alert_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_alerts_status_idx" ON "risk_alerts"("status");

-- CreateIndex
CREATE INDEX "risk_alerts_severity_idx" ON "risk_alerts"("severity");

-- CreateIndex
CREATE INDEX "risk_alerts_type_idx" ON "risk_alerts"("type");

-- CreateIndex
CREATE INDEX "risk_alerts_entityType_entityId_idx" ON "risk_alerts"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "risk_alerts_userId_idx" ON "risk_alerts"("userId");

-- CreateIndex
CREATE INDEX "risk_alerts_sellerId_idx" ON "risk_alerts"("sellerId");

-- CreateIndex
CREATE INDEX "risk_alerts_ruleCode_idx" ON "risk_alerts"("ruleCode");

-- CreateIndex
CREATE INDEX "risk_alert_histories_riskAlertId_idx" ON "risk_alert_histories"("riskAlertId");

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alert_histories" ADD CONSTRAINT "risk_alert_histories_riskAlertId_fkey" FOREIGN KEY ("riskAlertId") REFERENCES "risk_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alert_histories" ADD CONSTRAINT "risk_alert_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
