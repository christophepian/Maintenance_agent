-- FIN-COA-01: Chart of Accounts foundation
-- Adds ExpenseType, Account, and ExpenseMapping models

-- CreateTable
CREATE TABLE "ExpenseType" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'EXPENSE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseMapping" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "expenseTypeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "buildingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseType_orgId_name_key" ON "ExpenseType"("orgId", "name");
CREATE INDEX "ExpenseType_orgId_idx" ON "ExpenseType"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_orgId_name_key" ON "Account"("orgId", "name");
CREATE INDEX "Account_orgId_idx" ON "Account"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseMapping_orgId_expenseTypeId_buildingId_key" ON "ExpenseMapping"("orgId", "expenseTypeId", "buildingId");
CREATE INDEX "ExpenseMapping_orgId_idx" ON "ExpenseMapping"("orgId");
CREATE INDEX "ExpenseMapping_expenseTypeId_idx" ON "ExpenseMapping"("expenseTypeId");
CREATE INDEX "ExpenseMapping_accountId_idx" ON "ExpenseMapping"("accountId");

-- AddForeignKey
ALTER TABLE "ExpenseType" ADD CONSTRAINT "ExpenseType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseMapping" ADD CONSTRAINT "ExpenseMapping_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseMapping" ADD CONSTRAINT "ExpenseMapping_expenseTypeId_fkey" FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseMapping" ADD CONSTRAINT "ExpenseMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseMapping" ADD CONSTRAINT "ExpenseMapping_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
