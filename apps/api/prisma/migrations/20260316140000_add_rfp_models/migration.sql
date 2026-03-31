-- Gap-filling migration: RFP models, AppointmentSlot, JobRating created via db push
-- Restores tables to their initial state before subsequent ALTER TABLE migrations:
--   20260317120000: adds FK Rfp.requestId
--   20260318120000: adds extra columns to RfpQuote
--   20260318130000: adds RfpQuoteStatus enum, PENDING_OWNER_APPROVAL to RfpStatus,
--                   awardedQuoteId to Rfp, status to RfpQuote
--   20260323170000: adds scorePunctuality/scoreAccuracy/scoreCourtesy to JobRating

-- CreateEnum
CREATE TYPE "RfpStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfpInviteStatus" AS ENUM ('INVITED', 'DECLINED', 'RESPONDED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "RaterRole" AS ENUM ('CONTRACTOR', 'TENANT');

-- CreateTable: Rfp (initial state — without awardedQuoteId; requestId column present but no FK yet)
CREATE TABLE "Rfp" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT,
    "requestId" TEXT,
    "category" TEXT NOT NULL,
    "legalObligation" "LegalObligation" NOT NULL DEFAULT 'UNKNOWN',
    "status" "RfpStatus" NOT NULL DEFAULT 'DRAFT',
    "inviteCount" INTEGER NOT NULL DEFAULT 3,
    "deadlineAt" TIMESTAMP(3),
    "awardedContractorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfp_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RfpInvite
CREATE TABLE "RfpInvite" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "status" "RfpInviteStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RfpQuote (initial minimal state — without currency/vatIncluded/estimatedDurationDays/
--   earliestAvailability/lineItems/workPlan/assumptions/validUntil/status)
CREATE TABLE "RfpQuote" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AppointmentSlot
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'PROPOSED',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobRating (initial state — without scorePunctuality/scoreAccuracy/scoreCourtesy)
CREATE TABLE "JobRating" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "raterRole" "RaterRole" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rfp_orgId_idx" ON "Rfp"("orgId");
CREATE INDEX "Rfp_buildingId_idx" ON "Rfp"("buildingId");
CREATE INDEX "Rfp_requestId_idx" ON "Rfp"("requestId");
CREATE INDEX "Rfp_status_idx" ON "Rfp"("status");

CREATE UNIQUE INDEX "RfpInvite_rfpId_contractorId_key" ON "RfpInvite"("rfpId", "contractorId");
CREATE INDEX "RfpInvite_rfpId_idx" ON "RfpInvite"("rfpId");
CREATE INDEX "RfpInvite_contractorId_idx" ON "RfpInvite"("contractorId");

CREATE UNIQUE INDEX "RfpQuote_rfpId_contractorId_key" ON "RfpQuote"("rfpId", "contractorId");
CREATE INDEX "RfpQuote_rfpId_idx" ON "RfpQuote"("rfpId");
CREATE INDEX "RfpQuote_contractorId_idx" ON "RfpQuote"("contractorId");

CREATE INDEX "AppointmentSlot_jobId_idx" ON "AppointmentSlot"("jobId");
CREATE INDEX "AppointmentSlot_orgId_idx" ON "AppointmentSlot"("orgId");

CREATE UNIQUE INDEX "JobRating_jobId_raterRole_key" ON "JobRating"("jobId", "raterRole");
CREATE INDEX "JobRating_jobId_idx" ON "JobRating"("jobId");
CREATE INDEX "JobRating_orgId_idx" ON "JobRating"("orgId");

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_awardedContractorId_fkey"
    FOREIGN KEY ("awardedContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfpInvite" ADD CONSTRAINT "RfpInvite_rfpId_fkey"
    FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfpInvite" ADD CONSTRAINT "RfpInvite_contractorId_fkey"
    FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfpQuote" ADD CONSTRAINT "RfpQuote_rfpId_fkey"
    FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfpQuote" ADD CONSTRAINT "RfpQuote_contractorId_fkey"
    FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobRating" ADD CONSTRAINT "JobRating_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobRating" ADD CONSTRAINT "JobRating_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
