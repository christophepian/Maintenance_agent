-- CreateEnum
CREATE TYPE "StatementSectionType" AS ENUM ('BALANCE_SHEET', 'INCOME_STATEMENT', 'INVOICES');

-- AlterTable
ALTER TABLE "ImportedStatement" ADD COLUMN     "sectionType" "StatementSectionType" NOT NULL DEFAULT 'BALANCE_SHEET',
ADD COLUMN     "uploadBatchId" TEXT;

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceFileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadBatch_orgId_idx" ON "UploadBatch"("orgId");

-- CreateIndex
CREATE INDEX "ImportedStatement_uploadBatchId_idx" ON "ImportedStatement"("uploadBatchId");

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedStatement" ADD CONSTRAINT "ImportedStatement_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
