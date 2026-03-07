-- CreateEnum
CREATE TYPE "AssetInterventionType" AS ENUM ('REPAIR', 'REPLACEMENT');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "isPresent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "modelNumber" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "replacedAt" TIMESTAMP(3),
ADD COLUMN     "serialNumber" TEXT;

-- CreateTable
CREATE TABLE "AssetIntervention" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetInterventionType" NOT NULL,
    "interventionDate" TIMESTAMP(3) NOT NULL,
    "costChf" DOUBLE PRECISION,
    "jobId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetIntervention_assetId_idx" ON "AssetIntervention"("assetId");

-- CreateIndex
CREATE INDEX "AssetIntervention_jobId_idx" ON "AssetIntervention"("jobId");

-- AddForeignKey
ALTER TABLE "AssetIntervention" ADD CONSTRAINT "AssetIntervention_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetIntervention" ADD CONSTRAINT "AssetIntervention_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
