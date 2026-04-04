-- CreateEnum
CREATE TYPE "IndexClauseType" AS ENUM ('NONE', 'CPI_100', 'CPI_40_REFRATE_60');

-- CreateEnum
CREATE TYPE "RentAdjustmentType" AS ENUM ('CPI_INDEXATION', 'REFERENCE_RATE_CHANGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "RentAdjustmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'APPLIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "cpiBaseIndex" DECIMAL(65,30),
ADD COLUMN     "indexClauseType" "IndexClauseType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "initialNetRentChf" INTEGER,
ADD COLUMN     "lastIndexationDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RentAdjustment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "adjustmentType" "RentAdjustmentType" NOT NULL,
    "status" "RentAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousRentCents" INTEGER NOT NULL,
    "newRentCents" INTEGER NOT NULL,
    "adjustmentCents" INTEGER NOT NULL,
    "cpiOldIndex" DECIMAL(65,30),
    "cpiNewIndex" DECIMAL(65,30),
    "referenceRateOld" TEXT,
    "referenceRateNew" TEXT,
    "calculationDetails" JSONB,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentAdjustment_orgId_idx" ON "RentAdjustment"("orgId");

-- CreateIndex
CREATE INDEX "RentAdjustment_leaseId_idx" ON "RentAdjustment"("leaseId");

-- CreateIndex
CREATE INDEX "RentAdjustment_status_idx" ON "RentAdjustment"("status");

-- AddForeignKey
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
