-- Extraction cache: reuse a prior vision extraction for the identical uploaded file
-- (same content hash + extractor version) so re-uploads skip the costly scanDocument()
-- vision pass. Org-scoped for tenant isolation.
ALTER TABLE "UploadBatch" ADD COLUMN "fileHash" TEXT;
ALTER TABLE "UploadBatch" ADD COLUMN "scanResultJson" JSONB;
CREATE INDEX "UploadBatch_orgId_fileHash_idx" ON "UploadBatch"("orgId", "fileHash");
