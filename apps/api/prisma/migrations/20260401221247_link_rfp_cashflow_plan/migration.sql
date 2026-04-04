-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "cashflowGroupKey" TEXT,
ADD COLUMN     "cashflowPlanId" TEXT;

-- CreateIndex
CREATE INDEX "Rfp_cashflowPlanId_idx" ON "Rfp"("cashflowPlanId");

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_cashflowPlanId_fkey" FOREIGN KEY ("cashflowPlanId") REFERENCES "CashflowPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
