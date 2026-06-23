-- AddBuildingChargeDistribution: per-building per-category ventilation config (v2 C2)
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md

CREATE TABLE "BuildingChargeDistribution" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "key"        "DistributionKey" NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuildingChargeDistribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BuildingChargeDistribution_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuildingChargeDistribution_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuildingChargeDistribution_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AncillaryCostCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BuildingChargeDistribution_buildingId_categoryId_key" ON "BuildingChargeDistribution"("buildingId", "categoryId");
CREATE INDEX "BuildingChargeDistribution_orgId_idx" ON "BuildingChargeDistribution"("orgId");
CREATE INDEX "BuildingChargeDistribution_buildingId_idx" ON "BuildingChargeDistribution"("buildingId");

ALTER TABLE "BuildingChargeDistribution" ENABLE ROW LEVEL SECURITY;
