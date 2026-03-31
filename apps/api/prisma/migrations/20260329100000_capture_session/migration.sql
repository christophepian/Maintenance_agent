-- CreateEnum
CREATE TYPE "CaptureSessionStatus" AS ENUM ('CREATED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CaptureSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "CaptureSessionStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sourceChannel" "InvoiceSourceChannel" NOT NULL DEFAULT 'MOBILE_CAPTURE',
    "targetType" TEXT NOT NULL DEFAULT 'INVOICE',
    "uploadedFileUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptureSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptureSession_token_key" ON "CaptureSession"("token");

-- CreateIndex
CREATE INDEX "CaptureSession_orgId_status_idx" ON "CaptureSession"("orgId", "status");

-- CreateIndex
CREATE INDEX "CaptureSession_token_idx" ON "CaptureSession"("token");

-- CreateIndex
CREATE INDEX "CaptureSession_expiresAt_idx" ON "CaptureSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "CaptureSession" ADD CONSTRAINT "CaptureSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
