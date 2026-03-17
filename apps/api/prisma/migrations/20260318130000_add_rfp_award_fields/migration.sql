-- CreateEnum
CREATE TYPE "RfpQuoteStatus" AS ENUM ('SUBMITTED', 'AWARDED', 'REJECTED');

-- AlterEnum: add PENDING_OWNER_APPROVAL to RfpStatus
ALTER TYPE "RfpStatus" ADD VALUE 'PENDING_OWNER_APPROVAL';

-- AlterTable: add awardedQuoteId to Rfp
ALTER TABLE "Rfp" ADD COLUMN "awardedQuoteId" TEXT;

-- AlterTable: add status to RfpQuote
ALTER TABLE "RfpQuote" ADD COLUMN "status" "RfpQuoteStatus" NOT NULL DEFAULT 'SUBMITTED';
