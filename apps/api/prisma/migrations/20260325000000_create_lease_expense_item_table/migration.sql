-- Idempotent migration: creates LeaseExpenseItem table + ChargeMode enum
-- if they do not already exist (dev DB had them via db push; test DB does not).

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "ChargeMode" AS ENUM ('ACOMPTE', 'FORFAIT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "LeaseExpenseItem" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountChf" INTEGER NOT NULL,
    "mode" "ChargeMode" NOT NULL DEFAULT 'ACOMPTE',
    "expenseTypeId" TEXT,
    "accountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes (idempotent)
CREATE INDEX IF NOT EXISTS "LeaseExpenseItem_leaseId_idx" ON "LeaseExpenseItem"("leaseId");
CREATE INDEX IF NOT EXISTS "LeaseExpenseItem_expenseTypeId_idx" ON "LeaseExpenseItem"("expenseTypeId");
CREATE INDEX IF NOT EXISTS "LeaseExpenseItem_accountId_idx" ON "LeaseExpenseItem"("accountId");

-- AddForeignKeys (idempotent)
DO $$ BEGIN
  ALTER TABLE "LeaseExpenseItem" ADD CONSTRAINT "LeaseExpenseItem_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaseExpenseItem" ADD CONSTRAINT "LeaseExpenseItem_expenseTypeId_fkey"
    FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaseExpenseItem" ADD CONSTRAINT "LeaseExpenseItem_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
