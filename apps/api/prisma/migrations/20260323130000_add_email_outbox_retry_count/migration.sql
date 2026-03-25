-- AddColumn: retryCount to EmailOutbox for retry-aware delivery
ALTER TABLE "EmailOutbox" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
