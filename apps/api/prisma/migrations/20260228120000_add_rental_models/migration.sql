-- CreateEnum
CREATE TYPE "RentalApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ApplicantRole" AS ENUM ('PRIMARY', 'CO_APPLICANT');

-- CreateEnum
CREATE TYPE "RentalDocType" AS ENUM ('IDENTITY', 'SALARY_PROOF', 'PERMIT', 'DEBT_ENFORCEMENT_EXTRACT', 'HOUSEHOLD_INSURANCE', 'STUDENT_PROOF', 'PARKING_DOCS');

-- CreateEnum
CREATE TYPE "RentalApplicationUnitStatus" AS ENUM ('SUBMITTED', 'REJECTED', 'SELECTED_PRIMARY', 'SELECTED_BACKUP_1', 'SELECTED_BACKUP_2', 'AWAITING_SIGNATURE', 'SIGNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "RentalOwnerSelectionStatus" AS ENUM ('AWAITING_SIGNATURE', 'SIGNED', 'VOIDED', 'FALLBACK_1', 'FALLBACK_2', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailTemplate" AS ENUM ('MISSING_DOCS', 'REJECTED', 'SELECTED_LEASE_LINK');

-- AlterTable
ALTER TABLE "BuildingConfig" ADD COLUMN     "rentalIncomeMultiplier" DOUBLE PRECISION DEFAULT 3,
ADD COLUMN     "rentalManualReviewConfidenceThreshold" INTEGER DEFAULT 60,
ADD COLUMN     "rentalSignatureDeadlineDays" INTEGER DEFAULT 7;

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateBuildingId" TEXT,
ADD COLUMN     "templateName" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "isVacant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyChargesChf" INTEGER,
ADD COLUMN     "monthlyRentChf" INTEGER;

-- CreateTable
CREATE TABLE "RentalApplication" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "RentalApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "signedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "signatureIp" TEXT,
    "signatureUserAgent" TEXT,
    "applicationDataJson" JSONB,
    "currentLandlordName" TEXT,
    "currentLandlordAddress" TEXT,
    "currentLandlordPhone" TEXT,
    "reasonForLeaving" TEXT,
    "desiredMoveInDate" TIMESTAMP(3),
    "householdSize" INTEGER,
    "hasPets" BOOLEAN,
    "petsDescription" TEXT,
    "hasRcInsurance" BOOLEAN,
    "rcInsuranceCompany" TEXT,
    "hasVehicle" BOOLEAN,
    "vehicleDescription" TEXT,
    "needsParking" BOOLEAN,
    "remarks" TEXT,

    CONSTRAINT "RentalApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalApplicant" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "role" "ApplicantRole" NOT NULL DEFAULT 'PRIMARY',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthdate" TIMESTAMP(3),
    "nationality" TEXT,
    "civilStatus" TEXT,
    "permitType" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currentAddress" TEXT,
    "currentZipCity" TEXT,
    "employer" TEXT,
    "jobTitle" TEXT,
    "workLocation" TEXT,
    "employedSince" TIMESTAMP(3),
    "netMonthlyIncome" INTEGER,
    "hasDebtEnforcement" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalAttachment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "docType" "RentalDocType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionDeleteAt" TIMESTAMP(3),

    CONSTRAINT "RentalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalApplicationUnit" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RentalApplicationUnitStatus" NOT NULL DEFAULT 'SUBMITTED',
    "evaluationJson" JSONB,
    "scoreTotal" INTEGER,
    "confidenceScore" INTEGER,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "disqualifiedReasons" JSONB,
    "rank" INTEGER,
    "managerScoreDelta" INTEGER,
    "managerOverrideJson" JSONB,
    "managerOverrideReason" TEXT,

    CONSTRAINT "RentalApplicationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOwnerSelection" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "primaryApplicationUnitId" TEXT NOT NULL,
    "backup1ApplicationUnitId" TEXT,
    "backup2ApplicationUnitId" TEXT,
    "status" "RentalOwnerSelectionStatus" NOT NULL DEFAULT 'AWAITING_SIGNATURE',

    CONSTRAINT "RentalOwnerSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toEmail" TEXT NOT NULL,
    "template" "EmailTemplate" NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "metaJson" JSONB,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalApplication_orgId_idx" ON "RentalApplication"("orgId");

-- CreateIndex
CREATE INDEX "RentalApplication_status_idx" ON "RentalApplication"("status");

-- CreateIndex
CREATE INDEX "RentalApplicant_applicationId_idx" ON "RentalApplicant"("applicationId");

-- CreateIndex
CREATE INDEX "RentalAttachment_applicationId_idx" ON "RentalAttachment"("applicationId");

-- CreateIndex
CREATE INDEX "RentalAttachment_applicantId_idx" ON "RentalAttachment"("applicantId");

-- CreateIndex
CREATE INDEX "RentalAttachment_retentionDeleteAt_idx" ON "RentalAttachment"("retentionDeleteAt");

-- CreateIndex
CREATE INDEX "RentalApplicationUnit_applicationId_idx" ON "RentalApplicationUnit"("applicationId");

-- CreateIndex
CREATE INDEX "RentalApplicationUnit_unitId_idx" ON "RentalApplicationUnit"("unitId");

-- CreateIndex
CREATE INDEX "RentalApplicationUnit_unitId_rank_idx" ON "RentalApplicationUnit"("unitId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "RentalApplicationUnit_applicationId_unitId_key" ON "RentalApplicationUnit"("applicationId", "unitId");

-- CreateIndex
CREATE INDEX "RentalOwnerSelection_unitId_idx" ON "RentalOwnerSelection"("unitId");

-- CreateIndex
CREATE INDEX "RentalOwnerSelection_status_idx" ON "RentalOwnerSelection"("status");

-- CreateIndex
CREATE INDEX "RentalOwnerSelection_deadlineAt_idx" ON "RentalOwnerSelection"("deadlineAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_orgId_idx" ON "EmailOutbox"("orgId");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_idx" ON "EmailOutbox"("status");

-- CreateIndex
CREATE INDEX "Unit_isVacant_idx" ON "Unit"("isVacant");

-- AddForeignKey
ALTER TABLE "RentalApplication" ADD CONSTRAINT "RentalApplication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalApplicant" ADD CONSTRAINT "RentalApplicant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RentalApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAttachment" ADD CONSTRAINT "RentalAttachment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RentalApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAttachment" ADD CONSTRAINT "RentalAttachment_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "RentalApplicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalApplicationUnit" ADD CONSTRAINT "RentalApplicationUnit_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RentalApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalApplicationUnit" ADD CONSTRAINT "RentalApplicationUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOwnerSelection" ADD CONSTRAINT "RentalOwnerSelection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOwnerSelection" ADD CONSTRAINT "RentalOwnerSelection_primaryApplicationUnitId_fkey" FOREIGN KEY ("primaryApplicationUnitId") REFERENCES "RentalApplicationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOwnerSelection" ADD CONSTRAINT "RentalOwnerSelection_backup1ApplicationUnitId_fkey" FOREIGN KEY ("backup1ApplicationUnitId") REFERENCES "RentalApplicationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOwnerSelection" ADD CONSTRAINT "RentalOwnerSelection_backup2ApplicationUnitId_fkey" FOREIGN KEY ("backup2ApplicationUnitId") REFERENCES "RentalApplicationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

