-- Add the document's own declared section grand-totals (CHF cents) captured at
-- extraction, so the approval reconciliation gate can verify extracted line
-- items tie out to the statement's stated totals. Null = none extractable.
ALTER TABLE "ImportedStatement" ADD COLUMN "statedTotals" JSONB;
