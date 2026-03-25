-- FIN-COA-02: Wire mapped accounts into invoices
-- Adds optional expenseTypeId and accountId FK columns to Invoice.
-- Purely additive — existing invoices are unaffected (columns nullable, no backfill).

ALTER TABLE "Invoice" ADD COLUMN "expenseTypeId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "accountId" TEXT;

-- Foreign keys
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_expenseTypeId_fkey"
  FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
