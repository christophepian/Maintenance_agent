-- Reporting cost taxonomy override for imported régie income-statement accounts.
ALTER TABLE "Account" ADD COLUMN "costCategory" TEXT;
