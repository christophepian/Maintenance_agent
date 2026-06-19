-- CreateTable
CREATE TABLE "BuildingDailySnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "noiCents" INTEGER NOT NULL,
    "earnedIncomeCents" INTEGER NOT NULL,
    "expensesCents" INTEGER NOT NULL,
    "collectionRate" DOUBLE PRECISION NOT NULL,
    "noiMarginPct" DOUBLE PRECISION,
    "opexRatioPct" DOUBLE PRECISION,
    "occupancyRate" DOUBLE PRECISION,
    "activeUnitsCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildingDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildingDailySnapshot_orgId_buildingId_date_idx" ON "BuildingDailySnapshot"("orgId", "buildingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingDailySnapshot_orgId_buildingId_date_key" ON "BuildingDailySnapshot"("orgId", "buildingId", "date");

-- AddForeignKey
ALTER TABLE "BuildingDailySnapshot" ADD CONSTRAINT "BuildingDailySnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingDailySnapshot" ADD CONSTRAINT "BuildingDailySnapshot_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
