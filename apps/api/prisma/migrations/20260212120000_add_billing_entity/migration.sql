-- CreateEnum
CREATE TYPE "BillingEntityType" AS ENUM ('CONTRACTOR', 'ORG', 'OWNER');

-- CreateTable
CREATE TABLE "BillingEntity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "BillingEntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CH',
    "iban" TEXT NOT NULL,
    "vatNumber" TEXT,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 7.7,
    "nextInvoiceSequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingEntity_orgId_type_key" ON "BillingEntity"("orgId", "type");

-- CreateIndex
CREATE INDEX "BillingEntity_orgId_idx" ON "BillingEntity"("orgId");

-- AddForeignKey
ALTER TABLE "BillingEntity" ADD CONSTRAINT "BillingEntity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
