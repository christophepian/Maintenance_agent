-- Add unitId attribution to LedgerEntry for per-unit financial reporting
ALTER TABLE "LedgerEntry" ADD COLUMN "unitId" TEXT;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LedgerEntry_unitId_idx" ON "LedgerEntry"("unitId");
