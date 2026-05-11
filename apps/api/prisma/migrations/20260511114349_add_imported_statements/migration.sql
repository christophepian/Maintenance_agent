-- CreateEnum
CREATE TYPE "ImportedStatementStatus" AS ENUM ('PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('AUTO', 'FUZZY', 'CLAUDE', 'MANUAL', 'UNMATCHED');

-- CreateTable
CREATE TABLE "ImportedStatement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" "ImportedStatementStatus" NOT NULL DEFAULT 'PROCESSING',
    "sourceFileUrl" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rawOcrText" TEXT,
    "ocrConfidence" INTEGER,
    "buildingMatchConfidence" "MatchConfidence",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedAccountBalance" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "accountId" TEXT,
    "rawAccountCode" TEXT NOT NULL,
    "rawAccountName" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "balanceType" TEXT NOT NULL DEFAULT 'DEBIT',
    "matchConfidence" "MatchConfidence" NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedAccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportedStatement_orgId_idx" ON "ImportedStatement"("orgId");

-- CreateIndex
CREATE INDEX "ImportedStatement_buildingId_idx" ON "ImportedStatement"("buildingId");

-- CreateIndex
CREATE INDEX "ImportedStatement_orgId_status_idx" ON "ImportedStatement"("orgId", "status");

-- CreateIndex
CREATE INDEX "ImportedStatement_orgId_fiscalYear_idx" ON "ImportedStatement"("orgId", "fiscalYear");

-- CreateIndex
CREATE INDEX "ImportedAccountBalance_orgId_idx" ON "ImportedAccountBalance"("orgId");

-- CreateIndex
CREATE INDEX "ImportedAccountBalance_statementId_idx" ON "ImportedAccountBalance"("statementId");

-- CreateIndex
CREATE INDEX "ImportedAccountBalance_accountId_idx" ON "ImportedAccountBalance"("accountId");

-- AddForeignKey
ALTER TABLE "ImportedStatement" ADD CONSTRAINT "ImportedStatement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedStatement" ADD CONSTRAINT "ImportedStatement_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedAccountBalance" ADD CONSTRAINT "ImportedAccountBalance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedAccountBalance" ADD CONSTRAINT "ImportedAccountBalance_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ImportedStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedAccountBalance" ADD CONSTRAINT "ImportedAccountBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
