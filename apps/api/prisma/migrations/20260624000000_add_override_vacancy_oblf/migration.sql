-- Phase 2 (planning workspace NPV unification): persist vacancy + OBLF on the
-- override so the plan NPV reproduces the simulator exactly and the assumptions
-- are auditable. Both nullable → non-breaking.
ALTER TABLE "CashflowOverride" ADD COLUMN IF NOT EXISTS "vacancyMonths" INTEGER;
ALTER TABLE "CashflowOverride" ADD COLUMN IF NOT EXISTS "oblfPassthroughPct" DOUBLE PRECISION;
