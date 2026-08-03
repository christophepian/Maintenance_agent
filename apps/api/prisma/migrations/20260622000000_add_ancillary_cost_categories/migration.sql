-- AddAncillaryCostCategories: canonical Nebenkosten taxonomy + billable gate (Phase 1)
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md

-- New enums
CREATE TYPE "CostBillability" AS ENUM ('BILLABLE', 'NON_BILLABLE');
CREATE TYPE "DistributionKey" AS ENUM ('SURFACE_AREA', 'UNIT_COUNT', 'CONSUMPTION', 'OCCUPANT_COUNT', 'FIXED_SHARE');

-- Canonical ancillary cost category (org-scoped)
CREATE TABLE "AncillaryCostCategory" (
  "id"            TEXT NOT NULL,
  "orgId"         TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "billability"   "CostBillability" NOT NULL DEFAULT 'BILLABLE',
  "defaultKey"    "DistributionKey" NOT NULL DEFAULT 'SURFACE_AREA',
  "isAdminFee"    BOOLEAN NOT NULL DEFAULT false,
  "expenseTypeId" TEXT,
  "accountId"     TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AncillaryCostCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AncillaryCostCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AncillaryCostCategory_expenseTypeId_fkey" FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AncillaryCostCategory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AncillaryCostCategory_orgId_code_key" ON "AncillaryCostCategory"("orgId", "code");
CREATE INDEX "AncillaryCostCategory_orgId_idx" ON "AncillaryCostCategory"("orgId");

-- Block direct PostgREST access; backend connects via service_role (BYPASSRLS).
ALTER TABLE "AncillaryCostCategory" ENABLE ROW LEVEL SECURITY;

-- Link lease expense items to the canonical category
ALTER TABLE "LeaseExpenseItem" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "LeaseExpenseItem_categoryId_idx" ON "LeaseExpenseItem"("categoryId");

ALTER TABLE "LeaseExpenseItem" ADD CONSTRAINT "LeaseExpenseItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AncillaryCostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
