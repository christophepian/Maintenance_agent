-- AddMortgageAndBuildingValuation: Mortgage table + Building market value fields
-- Enables FCFE levered NPV, equity IRR, DSCR, LTV, and WACC.

-- New enum
CREATE TYPE "AmortizationType" AS ENUM ('INTEREST_ONLY', 'LINEAR', 'ANNUITY');

-- Building valuation fields
ALTER TABLE "Building" ADD COLUMN "marketValueChf" DOUBLE PRECISION,
ADD COLUMN "marketValueAt" TIMESTAMP(3);

-- Mortgage table
CREATE TABLE "Mortgage" (
  "id"                    TEXT NOT NULL,
  "orgId"                 TEXT NOT NULL,
  "buildingId"            TEXT NOT NULL,
  "lenderName"            TEXT,
  "originalPrincipalChf"  DOUBLE PRECISION NOT NULL,
  "currentBalanceChf"     DOUBLE PRECISION NOT NULL,
  "interestRatePct"       DOUBLE PRECISION NOT NULL,
  "amortizationType"      "AmortizationType" NOT NULL DEFAULT 'ANNUITY',
  "annualAmortizationChf" DOUBLE PRECISION,
  "startDate"             TIMESTAMP(3),
  "fixedUntil"            TIMESTAMP(3),
  "maturityDate"          TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mortgage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Mortgage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Mortgage_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Mortgage_orgId_idx" ON "Mortgage"("orgId");
CREATE INDEX "Mortgage_buildingId_idx" ON "Mortgage"("buildingId");

-- Block direct PostgREST access; backend connects via service_role (BYPASSRLS).
ALTER TABLE "Mortgage" ENABLE ROW LEVEL SECURITY;
