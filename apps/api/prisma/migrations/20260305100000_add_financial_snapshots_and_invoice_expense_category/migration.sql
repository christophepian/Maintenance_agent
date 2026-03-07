-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MAINTENANCE', 'UTILITIES', 'CLEANING', 'INSURANCE', 'TAX', 'ADMIN', 'CAPEX', 'OTHER');

-- AlterTable: Add expenseCategory to Invoice
ALTER TABLE "Invoice" ADD COLUMN "expenseCategory" "ExpenseCategory";

-- CreateTable: BuildingFinancialSnapshot (monthly cache for financial KPIs)
CREATE TABLE "BuildingFinancialSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "earnedIncomeCents" INTEGER NOT NULL,
    "projectedIncomeCents" INTEGER NOT NULL,
    "expensesTotalCents" INTEGER NOT NULL,
    "maintenanceTotalCents" INTEGER NOT NULL,
    "capexTotalCents" INTEGER NOT NULL,
    "operatingTotalCents" INTEGER NOT NULL,
    "netIncomeCents" INTEGER NOT NULL,
    "netOperatingIncomeCents" INTEGER NOT NULL,
    "activeUnitsCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildingFinancialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildingFinancialSnapshot_orgId_buildingId_periodStart_periodEnd_key"
    ON "BuildingFinancialSnapshot"("orgId", "buildingId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "BuildingFinancialSnapshot_orgId_idx" ON "BuildingFinancialSnapshot"("orgId");

-- CreateIndex
CREATE INDEX "BuildingFinancialSnapshot_buildingId_idx" ON "BuildingFinancialSnapshot"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingFinancialSnapshot_periodStart_periodEnd_idx" ON "BuildingFinancialSnapshot"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "BuildingFinancialSnapshot" ADD CONSTRAINT "BuildingFinancialSnapshot_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingFinancialSnapshot" ADD CONSTRAINT "BuildingFinancialSnapshot_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
