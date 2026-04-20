-- AlterTable: Add legacyApplianceId to Asset for Phase 2 backfill mapping
ALTER TABLE "Asset" ADD COLUMN "legacyApplianceId" TEXT;

-- CreateIndex: unique constraint for idempotent backfill
CREATE UNIQUE INDEX "Asset_legacyApplianceId_key" ON "Asset"("legacyApplianceId");
