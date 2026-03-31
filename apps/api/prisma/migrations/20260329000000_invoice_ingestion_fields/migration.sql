-- INV-HUB Prompt 2: Invoice ingestion fields
-- Additive-only migration: optional field relaxation + new enums + new nullable columns.
-- No data loss, no data migration needed.

-- 1. Create new enums
CREATE TYPE "InvoiceDirection" AS ENUM ('OUTGOING', 'INCOMING');
CREATE TYPE "InvoiceSourceChannel" AS ENUM ('MANUAL', 'BROWSER_UPLOAD', 'EMAIL_PDF', 'MOBILE_CAPTURE');
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'AUTO_CONFIRMED', 'REJECTED');

-- 2. Make jobId optional (relax NOT NULL constraint)
ALTER TABLE "Invoice" ALTER COLUMN "jobId" DROP NOT NULL;

-- 3. Add new columns with defaults / nullable
ALTER TABLE "Invoice" ADD COLUMN "direction" "InvoiceDirection" NOT NULL DEFAULT 'OUTGOING';
ALTER TABLE "Invoice" ADD COLUMN "sourceChannel" "InvoiceSourceChannel" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Invoice" ADD COLUMN "ingestionStatus" "IngestionStatus";
ALTER TABLE "Invoice" ADD COLUMN "rawOcrText" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "ocrConfidence" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "sourceFileUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "matchedJobId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "matchedLeaseId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "matchedBuildingId" TEXT;

-- 4. Add indexes for new query patterns
CREATE INDEX "Invoice_direction_idx" ON "Invoice"("direction");
CREATE INDEX "Invoice_ingestionStatus_idx" ON "Invoice"("ingestionStatus");
