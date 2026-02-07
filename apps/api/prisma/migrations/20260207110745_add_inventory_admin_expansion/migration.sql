/*
  Warnings:

  - You are about to drop the column `unitId` on the `Tenant` table. All the data in the column will be lost.
  - Added the required column `orgId` to the `Appliance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `Unit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RequestEventType" AS ENUM ('ARRIVED', 'PARTS_ORDERED', 'COMPLETED', 'NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('RESIDENTIAL', 'COMMON_AREA');

-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_unitId_fkey";

-- AlterTable
ALTER TABLE "Appliance" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "AssetModel" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "orgId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "type" "UnitType" NOT NULL DEFAULT 'RESIDENTIAL';

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "type" "RequestEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- Backfill orgId on Unit and Appliance
UPDATE "Unit" SET "orgId" = b."orgId"
FROM "Building" b
WHERE "Unit"."buildingId" = b."id" AND "Unit"."orgId" IS NULL;

UPDATE "Appliance" SET "orgId" = u."orgId"
FROM "Unit" u
WHERE "Appliance"."unitId" = u."id" AND "Appliance"."orgId" IS NULL;

-- Backfill Occupancy from legacy Tenant.unitId before drop
INSERT INTO "Occupancy" ("id", "tenantId", "unitId")
SELECT gen_random_uuid(), t."id", t."unitId"
FROM "Tenant" t
WHERE t."unitId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Occupancy" o
    WHERE o."tenantId" = t."id" AND o."unitId" = t."unitId"
  );

-- Now drop legacy unitId column
ALTER TABLE "Tenant" DROP COLUMN "unitId";

-- Enforce NOT NULL on orgId columns after backfill
ALTER TABLE "Unit" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Appliance" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_idx" ON "RequestEvent"("requestId");

-- CreateIndex
CREATE INDEX "RequestEvent_contractorId_idx" ON "RequestEvent"("contractorId");

-- CreateIndex
CREATE INDEX "Occupancy_tenantId_idx" ON "Occupancy"("tenantId");

-- CreateIndex
CREATE INDEX "Occupancy_unitId_idx" ON "Occupancy"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Occupancy_tenantId_unitId_key" ON "Occupancy"("tenantId", "unitId");

-- CreateIndex
CREATE INDEX "Appliance_orgId_idx" ON "Appliance"("orgId");

-- CreateIndex
CREATE INDEX "AssetModel_orgId_isActive_idx" ON "AssetModel"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "Unit_orgId_idx" ON "Unit"("orgId");

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appliance" ADD CONSTRAINT "Appliance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetModel" ADD CONSTRAINT "AssetModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
