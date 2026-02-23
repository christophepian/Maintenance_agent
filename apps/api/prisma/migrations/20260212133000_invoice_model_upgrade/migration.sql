-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'ISSUED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "issuerBillingEntityId" TEXT,
ADD COLUMN "recipientName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "recipientAddressLine1" TEXT NOT NULL DEFAULT '',
ADD COLUMN "recipientAddressLine2" TEXT,
ADD COLUMN "recipientPostalCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "recipientCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN "recipientCountry" TEXT NOT NULL DEFAULT 'CH',
ADD COLUMN "issueDate" TIMESTAMP(3),
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceNumberFormat" TEXT NOT NULL DEFAULT 'YYYY-NNN',
ADD COLUMN "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "vatAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CHF',
ADD COLUMN "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 7.7,
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "iban" TEXT,
ADD COLUMN "lockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 7.7,
    "subtotalAmount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orgId_invoiceNumber_key" ON "Invoice"("orgId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_issuerBillingEntityId_idx" ON "Invoice"("issuerBillingEntityId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuerBillingEntityId_fkey" FOREIGN KEY ("issuerBillingEntityId") REFERENCES "BillingEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
