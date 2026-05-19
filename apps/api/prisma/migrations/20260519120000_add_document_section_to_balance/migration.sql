-- Add documentSection to ImportedAccountBalance
-- Stores the balance-sheet section (ACTIF/PASSIF) or P&L section (REVENUE/EXPENSE)
-- extracted from the document header. Used for the section-based balance check
-- (sum ACTIF signed = sum PASSIF signed) instead of the old DEBIT-CREDIT trial-balance check.
-- Existing rows default to "UNKNOWN" and fall back to the old DEBIT/CREDIT logic.

ALTER TABLE "ImportedAccountBalance" ADD COLUMN "documentSection" TEXT NOT NULL DEFAULT 'UNKNOWN';
