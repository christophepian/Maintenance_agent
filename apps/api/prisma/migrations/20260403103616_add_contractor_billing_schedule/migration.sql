-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "contractorBillingScheduleId" TEXT,
ADD COLUMN     "contractorId" TEXT;

-- CreateTable
CREATE TABLE "ContractorBillingSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "status" "BillingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT NOT NULL,
    "frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "anchorDay" INTEGER NOT NULL DEFAULT 1,
    "nextPeriodStart" TIMESTAMP(3) NOT NULL,
    "lastGeneratedPeriod" TIMESTAMP(3),
    "amountCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 7.7,
    "buildingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completionReason" TEXT,

    CONSTRAINT "ContractorBillingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorBillingSchedule_orgId_idx" ON "ContractorBillingSchedule"("orgId");

-- CreateIndex
CREATE INDEX "ContractorBillingSchedule_contractorId_idx" ON "ContractorBillingSchedule"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorBillingSchedule_status_nextPeriodStart_idx" ON "ContractorBillingSchedule"("status", "nextPeriodStart");

-- CreateIndex
CREATE INDEX "Invoice_contractorId_idx" ON "Invoice"("contractorId");

-- CreateIndex
CREATE INDEX "Invoice_contractorBillingScheduleId_idx" ON "Invoice"("contractorBillingScheduleId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractorBillingScheduleId_fkey" FOREIGN KEY ("contractorBillingScheduleId") REFERENCES "ContractorBillingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBillingSchedule" ADD CONSTRAINT "ContractorBillingSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBillingSchedule" ADD CONSTRAINT "ContractorBillingSchedule_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBillingSchedule" ADD CONSTRAINT "ContractorBillingSchedule_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
