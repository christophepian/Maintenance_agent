-- AddCreditNotes: dedicated credit-note (avoir) document for reconciliation refunds (Phase 3a)
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md

-- Credit-note numbering sequence on the issuing billing entity
ALTER TABLE "BillingEntity" ADD COLUMN "nextCreditNoteSequence" INTEGER NOT NULL DEFAULT 1;

-- Link a reconciliation to its settlement credit note (refund path)
ALTER TABLE "ChargeReconciliation" ADD COLUMN "settlementCreditNoteId" TEXT;
CREATE UNIQUE INDEX "ChargeReconciliation_settlementCreditNoteId_key" ON "ChargeReconciliation"("settlementCreditNoteId");

CREATE TABLE "CreditNote" (
  "id"                    TEXT NOT NULL,
  "orgId"                 TEXT NOT NULL,
  "creditNoteNumber"      TEXT,
  "leaseId"               TEXT,
  "issuerBillingEntityId" TEXT,
  "recipientName"         TEXT,
  "recipientAddressLine1" TEXT,
  "recipientPostalCode"   TEXT,
  "recipientCity"         TEXT,
  "recipientCountry"      TEXT NOT NULL DEFAULT 'CH',
  "amountCents"           INTEGER NOT NULL,
  "currency"              TEXT NOT NULL DEFAULT 'CHF',
  "status"                TEXT NOT NULL DEFAULT 'ISSUED',
  "issueDate"             TIMESTAMP(3),
  "description"           TEXT,
  "lockedAt"              TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CreditNote_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CreditNote_issuerBillingEntityId_fkey" FOREIGN KEY ("issuerBillingEntityId") REFERENCES "BillingEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CreditNote_orgId_creditNoteNumber_key" ON "CreditNote"("orgId", "creditNoteNumber");
CREATE INDEX "CreditNote_orgId_idx" ON "CreditNote"("orgId");
CREATE INDEX "CreditNote_leaseId_idx" ON "CreditNote"("leaseId");

ALTER TABLE "CreditNote" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "CreditNoteLine" (
  "id"           TEXT NOT NULL,
  "creditNoteId" TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "amountCents"  INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");

ALTER TABLE "CreditNoteLine" ENABLE ROW LEVEL SECURITY;

-- FK for the reconciliation → credit note link (added after CreditNote exists)
ALTER TABLE "ChargeReconciliation" ADD CONSTRAINT "ChargeReconciliation_settlementCreditNoteId_fkey"
  FOREIGN KEY ("settlementCreditNoteId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
