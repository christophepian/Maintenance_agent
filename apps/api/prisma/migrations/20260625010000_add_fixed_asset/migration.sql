-- Accounting bridge WS-D: capitalized fixed assets + straight-line depreciation.
-- A CAPEX invoice is capitalized to the balance sheet (1500) and depreciated
-- over usefulLifeYears (Dr 4700 / Cr 1509 accumulated depreciation).
CREATE TABLE "FixedAsset" (
  "id"                           TEXT NOT NULL,
  "orgId"                        TEXT NOT NULL,
  "buildingId"                   TEXT NOT NULL,
  "unitId"                       TEXT,
  "name"                         TEXT NOT NULL,
  "sourceInvoiceId"              TEXT,
  "acquisitionDate"              TIMESTAMP(3) NOT NULL,
  "costCents"                    INTEGER NOT NULL,
  "salvageCents"                 INTEGER NOT NULL DEFAULT 0,
  "usefulLifeYears"              INTEGER NOT NULL,
  "method"                       TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
  "accumulatedDepreciationCents" INTEGER NOT NULL DEFAULT 0,
  "status"                       TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FixedAsset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FixedAsset_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FixedAsset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FixedAsset_sourceInvoiceId_key" ON "FixedAsset"("sourceInvoiceId");
CREATE INDEX "FixedAsset_orgId_idx" ON "FixedAsset"("orgId");
CREATE INDEX "FixedAsset_buildingId_idx" ON "FixedAsset"("buildingId");

-- Block direct PostgREST access; backend connects via service_role (BYPASSRLS).
ALTER TABLE "FixedAsset" ENABLE ROW LEVEL SECURITY;
