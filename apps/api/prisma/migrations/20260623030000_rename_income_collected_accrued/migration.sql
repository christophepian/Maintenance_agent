-- Rename income columns for clarity: earned = cash collected, projected = accrual-
-- recognized (from lease terms). Data preserved (column renames only).
-- See the recognition-basis discussion in the building report work.

ALTER TABLE "BuildingFinancialSnapshot" RENAME COLUMN "earnedIncomeCents" TO "collectedIncomeCents";
ALTER TABLE "BuildingFinancialSnapshot" RENAME COLUMN "projectedIncomeCents" TO "accruedIncomeCents";
ALTER TABLE "BuildingDailySnapshot" RENAME COLUMN "earnedIncomeCents" TO "collectedIncomeCents";
ALTER TABLE "PortfolioDailySnapshot" RENAME COLUMN "earnedIncomeCents" TO "collectedIncomeCents";
