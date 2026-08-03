-- LinkReconciliationToCostPool: auto-fill reconciliation actual costs from the
-- building cost pool by category, + admin fee (Phase 3b).
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md

ALTER TABLE "ChargeReconciliation" ADD COLUMN "adminFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "billingPeriodId" TEXT;

ALTER TABLE "ChargeReconciliation" ADD CONSTRAINT "ChargeReconciliation_billingPeriodId_fkey"
  FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChargeReconciliationLine" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "ChargeReconciliationLine_categoryId_idx" ON "ChargeReconciliationLine"("categoryId");
ALTER TABLE "ChargeReconciliationLine" ADD CONSTRAINT "ChargeReconciliationLine_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AncillaryCostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
