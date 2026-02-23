-- CreateEnum
CREATE TYPE "OrgMode" AS ENUM ('MANAGED', 'OWNER_DIRECT');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "mode" "OrgMode" NOT NULL DEFAULT 'MANAGED';

-- CreateTable
CREATE TABLE "BuildingConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "autoApproveLimit" INTEGER,
    "emergencyAutoDispatch" BOOLEAN,
    "requireOwnerApprovalAbove" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildingConfig_buildingId_key" ON "BuildingConfig"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingConfig_orgId_idx" ON "BuildingConfig"("orgId");

-- AddForeignKey
ALTER TABLE "BuildingConfig" ADD CONSTRAINT "BuildingConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingConfig" ADD CONSTRAINT "BuildingConfig_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
