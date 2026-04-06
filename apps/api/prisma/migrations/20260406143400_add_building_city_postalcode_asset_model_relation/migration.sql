-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "city" TEXT,
ADD COLUMN     "postalCode" TEXT;

-- CreateIndex
CREATE INDEX "Asset_assetModelId_idx" ON "Asset"("assetModelId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetModelId_fkey" FOREIGN KEY ("assetModelId") REFERENCES "AssetModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
