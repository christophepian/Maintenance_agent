-- CreateEnum
CREATE TYPE "ChargeReconciliationStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SETTLED');

-- CreateTable
CREATE TABLE "ChargeReconciliation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "status" "ChargeReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAcomptePaidCents" INTEGER NOT NULL DEFAULT 0,
    "totalActualCostsCents" INTEGER NOT NULL DEFAULT 0,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "settlementInvoiceId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargeReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeReconciliationLine" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chargeMode" "ChargeMode" NOT NULL,
    "acomptePaidCents" INTEGER NOT NULL DEFAULT 0,
    "actualCostCents" INTEGER NOT NULL DEFAULT 0,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChargeReconciliation_settlementInvoiceId_key" ON "ChargeReconciliation"("settlementInvoiceId");

-- CreateIndex
CREATE INDEX "ChargeReconciliation_orgId_idx" ON "ChargeReconciliation"("orgId");

-- CreateIndex
CREATE INDEX "ChargeReconciliation_status_idx" ON "ChargeReconciliation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeReconciliation_leaseId_fiscalYear_key" ON "ChargeReconciliation"("leaseId", "fiscalYear");

-- CreateIndex
CREATE INDEX "ChargeReconciliationLine_reconciliationId_idx" ON "ChargeReconciliationLine"("reconciliationId");

-- AddForeignKey
ALTER TABLE "ChargeReconciliation" ADD CONSTRAINT "ChargeReconciliation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeReconciliation" ADD CONSTRAINT "ChargeReconciliation_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeReconciliation" ADD CONSTRAINT "ChargeReconciliation_settlementInvoiceId_fkey" FOREIGN KEY ("settlementInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeReconciliationLine" ADD CONSTRAINT "ChargeReconciliationLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ChargeReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
