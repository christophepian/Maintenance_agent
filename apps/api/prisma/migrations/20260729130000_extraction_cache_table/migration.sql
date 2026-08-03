-- Move the vision-extraction cache to a dedicated content-addressed table so it
-- serves BOTH the single-statement path (scanDocument) and the régie-package
-- wizard path (extractPackageFromPdf). Drops the interim UploadBatch columns.
DROP INDEX IF EXISTS "UploadBatch_orgId_fileHash_idx";
ALTER TABLE "UploadBatch" DROP COLUMN IF EXISTS "fileHash";
ALTER TABLE "UploadBatch" DROP COLUMN IF EXISTS "scanResultJson";

CREATE TABLE "ExtractionCache" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractionCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExtractionCache_orgId_cacheKey_key" ON "ExtractionCache"("orgId", "cacheKey");
ALTER TABLE "ExtractionCache" ADD CONSTRAINT "ExtractionCache_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
