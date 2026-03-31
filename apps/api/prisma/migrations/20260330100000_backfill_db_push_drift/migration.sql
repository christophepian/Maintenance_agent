-- Drift backfill: reconciles all db-push drift accumulated since the G8 exception was introduced.
-- This migration runs on the shadow DB to produce a schema that matches schema.prisma exactly.
-- On the live DBs (maint_agent, maint_agent_test) it is marked as applied via
-- `prisma migrate resolve --applied` — the SQL is NOT re-executed there.
--
-- Items reconciled:
--   1. ApprovalSource enum (new)
--   2. RequestStatus new values: RFP_PENDING, OWNER_REJECTED
--   3. RequestEventType new value: TENANT_SELECTED
--   4. NotificationEventType new values: TENANT_SELECTED, LEASE_READY_TO_SIGN, LEASE_SIGNED,
--      APPLICATION_SUBMITTED, SLOT_PROPOSED, SLOT_ACCEPTED, SLOT_DECLINED,
--      SCHEDULING_ESCALATED, JOB_CONFIRMED, RATING_SUBMITTED
--   5. EmailTemplate new value: MANAGER_TENANT_SELECTED
--   6. Request new columns: approvalSource, rejectionReason
--   7. Invoice new column: leaseId + FK + index
--   8. InvoiceLineItem schema drift: drop legacy columns, retype quantity, add lineTotal

-- ── 1. New enum ──────────────────────────────────────────────────────────────

CREATE TYPE "ApprovalSource" AS ENUM ('SYSTEM_AUTO', 'OWNER_APPROVED', 'OWNER_REJECTED', 'LEGAL_OBLIGATION');

-- ── 2. RequestStatus new values ──────────────────────────────────────────────

ALTER TYPE "RequestStatus" ADD VALUE 'RFP_PENDING';
ALTER TYPE "RequestStatus" ADD VALUE 'OWNER_REJECTED';

-- ── 3. RequestEventType new value ────────────────────────────────────────────

ALTER TYPE "RequestEventType" ADD VALUE 'TENANT_SELECTED';

-- ── 4. NotificationEventType new values ──────────────────────────────────────

ALTER TYPE "NotificationEventType" ADD VALUE 'TENANT_SELECTED';
ALTER TYPE "NotificationEventType" ADD VALUE 'LEASE_READY_TO_SIGN';
ALTER TYPE "NotificationEventType" ADD VALUE 'LEASE_SIGNED';
ALTER TYPE "NotificationEventType" ADD VALUE 'APPLICATION_SUBMITTED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SLOT_PROPOSED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SLOT_ACCEPTED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SLOT_DECLINED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SCHEDULING_ESCALATED';
ALTER TYPE "NotificationEventType" ADD VALUE 'JOB_CONFIRMED';
ALTER TYPE "NotificationEventType" ADD VALUE 'RATING_SUBMITTED';

-- ── 5. EmailTemplate new value ───────────────────────────────────────────────

ALTER TYPE "EmailTemplate" ADD VALUE 'MANAGER_TENANT_SELECTED';

-- ── 6. Request: missing columns ──────────────────────────────────────────────

ALTER TABLE "Request"
    ADD COLUMN "approvalSource"  "ApprovalSource",
    ADD COLUMN "rejectionReason" TEXT;

-- ── 7. Invoice: leaseId ──────────────────────────────────────────────────────

ALTER TABLE "Invoice" ADD COLUMN "leaseId" TEXT;

CREATE INDEX "Invoice_leaseId_idx" ON "Invoice"("leaseId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 8. InvoiceLineItem: reconcile schema drift ───────────────────────────────
-- Legacy shape (20260212133000): quantity INTEGER, subtotalAmount, vatAmount, totalAmount, updatedAt
-- Target shape (schema.prisma):  quantity DOUBLE PRECISION, lineTotal INTEGER, no subtotal/vat/total/updatedAt

ALTER TABLE "InvoiceLineItem" DROP COLUMN "subtotalAmount";
ALTER TABLE "InvoiceLineItem" DROP COLUMN "vatAmount";
ALTER TABLE "InvoiceLineItem" DROP COLUMN "totalAmount";
ALTER TABLE "InvoiceLineItem" DROP COLUMN "updatedAt";

ALTER TABLE "InvoiceLineItem" ALTER COLUMN "quantity" TYPE DOUBLE PRECISION;

ALTER TABLE "InvoiceLineItem" ADD COLUMN "lineTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceLineItem" ALTER COLUMN "lineTotal" DROP DEFAULT;

-- ── 9. Invoice: fix recipient default values ─────────────────────────────────
-- 20260212133000 used '' but schema.prisma now uses 'Unknown' / '0000'

ALTER TABLE "Invoice" ALTER COLUMN "recipientName"         SET DEFAULT 'Unknown';
ALTER TABLE "Invoice" ALTER COLUMN "recipientAddressLine1" SET DEFAULT 'Unknown';
ALTER TABLE "Invoice" ALTER COLUMN "recipientPostalCode"   SET DEFAULT '0000';
ALTER TABLE "Invoice" ALTER COLUMN "recipientCity"         SET DEFAULT 'Unknown';

-- ── 10. SignatureRequest: FK on entityId (relation to Lease) ─────────────────

ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 11. Building: canton columns ─────────────────────────────────────────────

ALTER TABLE "Building"
    ADD COLUMN "canton"          TEXT,
    ADD COLUMN "cantonDerivedAt" TIMESTAMP(3);

-- ── 12. BuildingConfig: rfpDefaultInviteCount ────────────────────────────────

ALTER TABLE "BuildingConfig" ADD COLUMN "rfpDefaultInviteCount" INTEGER DEFAULT 3;

-- ── 13. OrgConfig: autoLegalRouting + landlord party columns ─────────────────

ALTER TABLE "OrgConfig"
    ADD COLUMN "autoLegalRouting"      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "landlordName"          TEXT,
    ADD COLUMN "landlordAddress"       TEXT,
    ADD COLUMN "landlordZipCity"       TEXT,
    ADD COLUMN "landlordPhone"         TEXT,
    ADD COLUMN "landlordEmail"         TEXT,
    ADD COLUMN "landlordRepresentedBy" TEXT;

-- ── 14. Job: scheduling + confirmation columns ───────────────────────────────

ALTER TABLE "Job"
    ADD COLUMN "schedulingExpiresAt" TIMESTAMP(3),
    ADD COLUMN "confirmedAt"         TIMESTAMP(3);

-- ── 15. BuildingFinancialSnapshot: unique index name reconciliation ───────────
-- Migration created the index with a name that PG truncates differently on each DB.
-- Rename shadow-DB truncation to match live-DB name so schema is consistent.

ALTER INDEX IF EXISTS "BuildingFinancialSnapshot_orgId_buildingId_periodStart_periodEn"
    RENAME TO "BuildingFinancialSnapshot_orgId_buildingId_periodStart_peri_key";
