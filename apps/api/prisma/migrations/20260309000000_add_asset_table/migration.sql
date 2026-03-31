-- Gap-filling migration: Asset table created via db push
-- This migration restores Asset to its initial state (before 20260310100000 added
-- brand, isPresent, modelNumber, notes, replacedAt, serialNumber).

-- CreateTable: Asset (initial state — without brand/isPresent/modelNumber/notes/replacedAt/serialNumber)
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "topic" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetModelId" TEXT,
    "installedAt" TIMESTAMP(3),
    "lastRenovatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_orgId_idx" ON "Asset"("orgId");
CREATE INDEX "Asset_unitId_idx" ON "Asset"("unitId");
CREATE INDEX "Asset_type_topic_idx" ON "Asset"("type", "topic");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
