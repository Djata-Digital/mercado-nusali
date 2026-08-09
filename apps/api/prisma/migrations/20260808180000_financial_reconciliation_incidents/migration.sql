CREATE TYPE "FinancialReconciliationIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "FinancialReconciliationIncidentSeverity" AS ENUM ('WARNING', 'CRITICAL');

CREATE TABLE "FinancialReconciliationIncident" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "paymentId" TEXT,
  "orderGroupId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" "FinancialReconciliationIncidentSeverity" NOT NULL,
  "status" "FinancialReconciliationIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "expectedValue" TEXT,
  "actualValue" TEXT,
  "detailsJson" JSONB,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialReconciliationIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialReconciliationIncident_fingerprint_key" ON "FinancialReconciliationIncident"("fingerprint");
CREATE INDEX "FinancialReconciliationIncident_status_severity_lastSeenAt_idx" ON "FinancialReconciliationIncident"("status","severity","lastSeenAt");
CREATE INDEX "FinancialReconciliationIncident_orderGroupId_status_idx" ON "FinancialReconciliationIncident"("orderGroupId","status");
CREATE INDEX "FinancialReconciliationIncident_paymentId_status_idx" ON "FinancialReconciliationIncident"("paymentId","status");
