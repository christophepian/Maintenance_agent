-- Gap-filling migration: Lease tables created via db push (LKDE epic, ~2026-02-23)
-- These tables existed in the DB but had no migration file, causing shadow DB replay
-- to fail at 20260228120000_add_rental_models (ALTER TABLE "Lease" ...).
-- This migration restores Lease and SignatureRequest to their initial state
-- (before 20260228120000 added isTemplate/templateBuildingId/templateName,
--  and before 20260304115550 added deletedAt).

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'READY_TO_SIGN', 'SIGNED', 'ACTIVE', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('INTERNAL', 'DOCUSIGN', 'SKRIBBLE');

-- CreateEnum
CREATE TYPE "SignatureLevel" AS ENUM ('SES', 'AES', 'QES');

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'DECLINED', 'EXPIRED', 'ERROR');

-- CreateTable: Lease (initial state — without isTemplate/templateBuildingId/templateName/deletedAt)
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',

    "applicationId" TEXT,
    "unitId" TEXT NOT NULL,

    -- Parties landlord
    "landlordName" TEXT NOT NULL,
    "landlordAddress" TEXT NOT NULL,
    "landlordZipCity" TEXT NOT NULL,
    "landlordPhone" TEXT,
    "landlordEmail" TEXT,
    "landlordRepresentedBy" TEXT,

    -- Parties tenant
    "tenantName" TEXT NOT NULL,
    "tenantAddress" TEXT,
    "tenantZipCity" TEXT,
    "tenantPhone" TEXT,
    "tenantEmail" TEXT,
    "coTenantName" TEXT,

    -- Object
    "objectType" TEXT NOT NULL DEFAULT 'APPARTEMENT',
    "roomsCount" TEXT,
    "floor" TEXT,
    "buildingAddressLines" JSONB,
    "usageFlags" JSONB,
    "serviceSpaces" JSONB,
    "commonInstallations" JSONB,

    -- Dates / termination
    "startDate" TIMESTAMP(3) NOT NULL,
    "isFixedTerm" BOOLEAN NOT NULL DEFAULT false,
    "endDate" TIMESTAMP(3),
    "firstTerminationDate" TIMESTAMP(3),
    "noticeRule" TEXT NOT NULL DEFAULT '3_MONTHS',
    "extendedNoticeText" TEXT,
    "terminationDatesRule" TEXT NOT NULL DEFAULT 'END_OF_MONTH_EXCEPT_31_12',
    "terminationDatesCustomText" TEXT,

    -- Rent & charges
    "netRentChf" INTEGER NOT NULL,
    "garageRentChf" INTEGER,
    "otherServiceRentChf" INTEGER,
    "chargesItems" JSONB,
    "chargesTotalChf" INTEGER,
    "rentTotalChf" INTEGER,
    "chargesSettlementDate" TEXT,
    "paymentDueDayOfMonth" INTEGER,
    "paymentRecipient" TEXT,
    "paymentInstitution" TEXT,
    "paymentAccountNumber" TEXT,
    "paymentIban" TEXT,
    "referenceRatePercent" TEXT,
    "referenceRateDate" TEXT,

    -- Deposit
    "depositChf" INTEGER,
    "depositDueRule" TEXT NOT NULL DEFAULT 'AT_SIGNATURE',
    "depositDueDate" TIMESTAMP(3),

    -- Stipulations
    "otherStipulations" TEXT,
    "includesHouseRules" BOOLEAN NOT NULL DEFAULT false,
    "otherAnnexesText" TEXT,

    -- Artifacts
    "draftPdfStorageKey" TEXT,
    "draftPdfSha256" TEXT,
    "signedPdfStorageKey" TEXT,
    "signedPdfSha256" TEXT,

    -- Deposit payment tracking
    "depositPaidAt" TIMESTAMP(3),
    "depositConfirmedBy" TEXT,
    "depositBankRef" TEXT,

    -- Activation & termination lifecycle
    "activatedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "terminationNotice" TEXT,
    "archivedAt" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SignatureRequest
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'LEASE',
    "entityId" TEXT NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'INTERNAL',
    "level" "SignatureLevel" NOT NULL DEFAULT 'SES',
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "providerEnvelopeId" TEXT,
    "signersJson" JSONB NOT NULL,
    "auditTrailStorageKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "Lease_orgId_idx" ON "Lease"("orgId");
CREATE INDEX "Lease_unitId_idx" ON "Lease"("unitId");
CREATE INDEX "Lease_applicationId_idx" ON "Lease"("applicationId");
CREATE INDEX "Lease_status_idx" ON "Lease"("status");

CREATE INDEX "SignatureRequest_orgId_idx" ON "SignatureRequest"("orgId");
CREATE INDEX "SignatureRequest_entityType_entityId_idx" ON "SignatureRequest"("entityType", "entityId");
CREATE INDEX "SignatureRequest_status_idx" ON "SignatureRequest"("status");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
