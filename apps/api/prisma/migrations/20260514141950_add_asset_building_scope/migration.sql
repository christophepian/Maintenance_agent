-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "buildingId" TEXT,
ALTER COLUMN "unitId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Asset_buildingId_idx" ON "Asset"("buildingId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
