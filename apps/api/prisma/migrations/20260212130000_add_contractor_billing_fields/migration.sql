-- Add billing fields to Contractor
ALTER TABLE "Contractor" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "city" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "country" TEXT DEFAULT 'CH';
ALTER TABLE "Contractor" ADD COLUMN "iban" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "vatNumber" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "defaultVatRate" DOUBLE PRECISION DEFAULT 7.7;
