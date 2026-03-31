-- CreateTable: LedgerEntry
-- Double-entry journal for property financial tracking.
-- Each economic event produces two rows (debit + credit) sharing the same journalId.
-- Amounts in CHF cents to avoid floating-point rounding.

CREATE TABLE "LedgerEntry" (
    "id"          TEXT        NOT NULL,
    "orgId"       TEXT        NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL,
    "accountId"   TEXT        NOT NULL,
    "debitCents"  INTEGER     NOT NULL DEFAULT 0,
    "creditCents" INTEGER     NOT NULL DEFAULT 0,
    "description" TEXT        NOT NULL,
    "reference"   TEXT,
    "sourceType"  TEXT,
    "sourceId"    TEXT,
    "journalId"   TEXT        NOT NULL,
    "buildingId"  TEXT,
    "createdBy"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "LedgerEntry_orgId_idx"              ON "LedgerEntry"("orgId");
CREATE INDEX "LedgerEntry_orgId_date_idx"          ON "LedgerEntry"("orgId", "date");
CREATE INDEX "LedgerEntry_accountId_idx"           ON "LedgerEntry"("accountId");
CREATE INDEX "LedgerEntry_journalId_idx"           ON "LedgerEntry"("journalId");
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");
CREATE INDEX "LedgerEntry_buildingId_idx"          ON "LedgerEntry"("buildingId");

-- Foreign keys
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
