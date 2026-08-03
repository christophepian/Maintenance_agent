-- CreateTable
CREATE TABLE "PortfolioDailySnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
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

    CONSTRAINT "PortfolioDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioDailySnapshot_orgId_date_idx" ON "PortfolioDailySnapshot"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioDailySnapshot_orgId_date_key" ON "PortfolioDailySnapshot"("orgId", "date");

-- AddForeignKey
ALTER TABLE "PortfolioDailySnapshot" ADD CONSTRAINT "PortfolioDailySnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
