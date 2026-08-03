-- Accounting bridge WS-E: year-end closing journals.
-- One row per building per fiscal year, recording the YEAR_END_CLOSE journal that
-- moves the net P&L result into retained earnings (2900). Reversible to reopen.
CREATE TABLE "FiscalPeriodClose" (
  "id"                    TEXT NOT NULL,
  "orgId"                 TEXT NOT NULL,
  "buildingId"            TEXT NOT NULL,
  "fiscalYear"            INTEGER NOT NULL,
  "periodStart"           TIMESTAMP(3) NOT NULL,
  "periodEnd"             TIMESTAMP(3) NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'CLOSED',
  "closingJournalId"      TEXT NOT NULL,
  "reversalJournalId"     TEXT,
  "retainedEarningsCents" INTEGER NOT NULL,
  "closedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedBy"              TEXT,
  "reversedAt"            TIMESTAMP(3),
  "reversedBy"            TEXT,
  CONSTRAINT "FiscalPeriodClose_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalPeriodClose_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FiscalPeriodClose_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FiscalPeriodClose_orgId_buildingId_fiscalYear_key" ON "FiscalPeriodClose"("orgId", "buildingId", "fiscalYear");
CREATE INDEX "FiscalPeriodClose_orgId_idx" ON "FiscalPeriodClose"("orgId");
CREATE INDEX "FiscalPeriodClose_buildingId_idx" ON "FiscalPeriodClose"("buildingId");

-- Block direct PostgREST access; backend connects via service_role (BYPASSRLS).
ALTER TABLE "FiscalPeriodClose" ENABLE ROW LEVEL SECURITY;
