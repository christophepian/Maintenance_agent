-- Accounting bridge WS-F: per-tenant opening receivables.
-- Sub-ledger breakdown of the imported account-level AR lump (account 1100);
-- the sum is reconciled to that lump. Settling posts Dr 1020 / Cr 1100.
CREATE TABLE "OpeningReceivable" (
  "id"                  TEXT NOT NULL,
  "orgId"               TEXT NOT NULL,
  "buildingId"          TEXT NOT NULL,
  "unitId"              TEXT,
  "tenantName"          TEXT NOT NULL,
  "amountCents"         INTEGER NOT NULL,
  "dueDate"             TIMESTAMP(3),
  "status"              TEXT NOT NULL DEFAULT 'OPEN',
  "settlementJournalId" TEXT,
  "settledAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpeningReceivable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpeningReceivable_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OpeningReceivable_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OpeningReceivable_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OpeningReceivable_orgId_idx" ON "OpeningReceivable"("orgId");
CREATE INDEX "OpeningReceivable_buildingId_idx" ON "OpeningReceivable"("buildingId");

-- Block direct PostgREST access; backend connects via service_role (BYPASSRLS).
ALTER TABLE "OpeningReceivable" ENABLE ROW LEVEL SECURITY;
