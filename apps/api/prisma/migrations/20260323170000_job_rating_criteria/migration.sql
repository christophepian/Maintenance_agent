-- FIN-REVIEW: Per-criteria scores on JobRating
-- Adds three nullable columns for the three rating dimensions.
-- score (existing) remains as the overall/average score for aggregate queries.
-- All columns nullable so existing rows are unaffected.

ALTER TABLE "JobRating" ADD COLUMN "scorePunctuality" INTEGER;
ALTER TABLE "JobRating" ADD COLUMN "scoreAccuracy"    INTEGER;
ALTER TABLE "JobRating" ADD COLUMN "scoreCourtesy"    INTEGER;
