-- AddInspectionRights: tenant document-inspection workflow for charge statements (Phase 4)
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md

ALTER TABLE "ChargeReconciliation" ADD COLUMN "issuedAt" TIMESTAMP(3),
ADD COLUMN "inspectionDeadline" TIMESTAMP(3);

CREATE TABLE "StatementDocRequest" (
  "id"               TEXT NOT NULL,
  "orgId"            TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'OPEN',
  "note"             TEXT,
  "requestedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt"      TIMESTAMP(3),
  CONSTRAINT "StatementDocRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StatementDocRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StatementDocRequest_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ChargeReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StatementDocRequest_orgId_idx" ON "StatementDocRequest"("orgId");
CREATE INDEX "StatementDocRequest_reconciliationId_idx" ON "StatementDocRequest"("reconciliationId");

ALTER TABLE "StatementDocRequest" ENABLE ROW LEVEL SECURITY;
