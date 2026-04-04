-- CreateEnum
CREATE TYPE "BillingScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billingPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "billingPeriodStart" TIMESTAMP(3),
ADD COLUMN     "billingScheduleId" TEXT,
ADD COLUMN     "isBackfilled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrgConfig" ADD COLUMN     "invoiceLeadTimeDays" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "RecurringBillingSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "status" "BillingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "anchorDay" INTEGER NOT NULL DEFAULT 1,
    "nextPeriodStart" TIMESTAMP(3) NOT NULL,
    "lastGeneratedPeriod" TIMESTAMP(3),
    "baseRentCents" INTEGER NOT NULL,
    "totalChargesCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completionReason" TEXT,

    CONSTRAINT "RecurringBillingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringBillingSchedule_leaseId_key" ON "RecurringBillingSchedule"("leaseId");

-- CreateIndex
CREATE INDEX "RecurringBillingSchedule_orgId_idx" ON "RecurringBillingSchedule"("orgId");

-- CreateIndex
CREATE INDEX "RecurringBillingSchedule_status_nextPeriodStart_idx" ON "RecurringBillingSchedule"("status", "nextPeriodStart");

-- CreateIndex
CREATE INDEX "Invoice_billingScheduleId_idx" ON "Invoice"("billingScheduleId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingScheduleId_fkey" FOREIGN KEY ("billingScheduleId") REFERENCES "RecurringBillingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBillingSchedule" ADD CONSTRAINT "RecurringBillingSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBillingSchedule" ADD CONSTRAINT "RecurringBillingSchedule_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
