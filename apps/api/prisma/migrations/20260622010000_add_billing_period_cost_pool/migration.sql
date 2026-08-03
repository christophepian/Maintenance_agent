-- AddBillingPeriodCostPool: building-level ancillary cost pool + distribution inputs (Phase 2)
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md

-- Distribution-key inputs on the lease (SURFACE_AREA uses Unit.livingAreaSqm)
ALTER TABLE "Lease" ADD COLUMN "occupantCount" INTEGER,
ADD COLUMN "fixedSharePermille" INTEGER;

-- Tag recurring rent invoice lines with their canonical category
ALTER TABLE "InvoiceLineItem" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "InvoiceLineItem_categoryId_idx" ON "InvoiceLineItem"("categoryId");
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AncillaryCostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Building cost pool: a billing period collects actual incurred costs
CREATE TABLE "BillingPeriod" (
  "id"                   TEXT NOT NULL,
  "orgId"                TEXT NOT NULL,
  "buildingId"           TEXT NOT NULL,
  "startDate"            TIMESTAMP(3) NOT NULL,
  "endDate"              TIMESTAMP(3) NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'OPEN',
  "adminFeeRatePermille" INTEGER NOT NULL DEFAULT 0,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingPeriod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BillingPeriod_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BillingPeriod_buildingId_startDate_endDate_key" ON "BillingPeriod"("buildingId", "startDate", "endDate");
CREATE INDEX "BillingPeriod_orgId_idx" ON "BillingPeriod"("orgId");
CREATE INDEX "BillingPeriod_buildingId_idx" ON "BillingPeriod"("buildingId");

ALTER TABLE "BillingPeriod" ENABLE ROW LEVEL SECURITY;

-- One actual incurred cost booked to a category within a billing period
CREATE TABLE "CostEntry" (
  "id"              TEXT NOT NULL,
  "billingPeriodId" TEXT NOT NULL,
  "categoryId"      TEXT NOT NULL,
  "amountCents"     INTEGER NOT NULL,
  "sourceInvoiceId" TEXT,
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostEntry_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CostEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AncillaryCostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CostEntry_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CostEntry_billingPeriodId_idx" ON "CostEntry"("billingPeriodId");
CREATE INDEX "CostEntry_categoryId_idx" ON "CostEntry"("categoryId");

ALTER TABLE "CostEntry" ENABLE ROW LEVEL SECURITY;
