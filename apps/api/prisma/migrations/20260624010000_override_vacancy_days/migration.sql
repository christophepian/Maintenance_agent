-- Vacancy is measured in days, not months (works can be a matter of hours).
-- Replace the just-added vacancyMonths column with vacancyDays. Both nullable;
-- vacancyMonths carried no meaningful production data (added same day).
ALTER TABLE "CashflowOverride" ADD COLUMN IF NOT EXISTS "vacancyDays" INTEGER;
ALTER TABLE "CashflowOverride" DROP COLUMN IF EXISTS "vacancyMonths";
