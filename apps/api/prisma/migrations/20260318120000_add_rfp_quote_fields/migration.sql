-- AlterTable
ALTER TABLE "RfpQuote" ADD COLUMN     "assumptions" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CHF',
ADD COLUMN     "earliestAvailability" TIMESTAMP(3),
ADD COLUMN     "estimatedDurationDays" INTEGER,
ADD COLUMN     "lineItems" JSONB,
ADD COLUMN     "validUntil" TIMESTAMP(3),
ADD COLUMN     "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workPlan" TEXT;
