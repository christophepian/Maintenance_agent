-- AddRenovationEconomicsToOverride: carry the simulator's renovation economics
-- onto CashflowOverride so the plan NPV (Invest/Defer/Neglect) credits the same
-- rent uplift and avoided risk the simulator used — keeping the two consistent.

ALTER TABLE "CashflowOverride" ADD COLUMN "costChf" DOUBLE PRECISION,
ADD COLUMN "rentUpliftChfPerMonth" DOUBLE PRECISION,
ADD COLUMN "riskAvoidedChfPerYear" DOUBLE PRECISION;
