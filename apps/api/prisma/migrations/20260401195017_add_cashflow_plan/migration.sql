-- CreateEnum
CREATE TYPE "CashflowPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateTable
CREATE TABLE "CashflowPlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT,
    "name" TEXT NOT NULL,
    "status" "CashflowPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "incomeGrowthRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingBalanceCents" BIGINT,
    "horizonMonths" INTEGER NOT NULL DEFAULT 60,
    "lastComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashflowOverride" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "originalYear" INTEGER NOT NULL,
    "overriddenYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashflowOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashflowPlan_orgId_idx" ON "CashflowPlan"("orgId");

-- CreateIndex
CREATE INDEX "CashflowPlan_orgId_buildingId_idx" ON "CashflowPlan"("orgId", "buildingId");

-- CreateIndex
CREATE INDEX "CashflowOverride_planId_idx" ON "CashflowOverride"("planId");

-- CreateIndex
CREATE INDEX "CashflowOverride_assetId_idx" ON "CashflowOverride"("assetId");

-- AddForeignKey
ALTER TABLE "CashflowPlan" ADD CONSTRAINT "CashflowPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowPlan" ADD CONSTRAINT "CashflowPlan_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowOverride" ADD CONSTRAINT "CashflowOverride_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashflowPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowOverride" ADD CONSTRAINT "CashflowOverride_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
