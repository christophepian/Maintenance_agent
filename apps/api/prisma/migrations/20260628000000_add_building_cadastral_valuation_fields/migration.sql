-- Building: cadastral / physical / valuation attributes (Swiss régie data sheet).
-- All nullable, no defaults — non-breaking. Valeur vénale reuses the existing
-- marketValueChf column; état locatif net is computed from rents, not stored.
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "parcelNumber"        TEXT;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "easementsText"       TEXT;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "ecaVolumeM3"         DOUBLE PRECISION;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "netAreaSqm"          DOUBLE PRECISION;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "weightedAreaSqm"     DOUBLE PRECISION;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "lotsApartments"      INTEGER;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "lotsGarages"         INTEGER;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "lotsExteriorParking" INTEGER;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "constructionDate"    TIMESTAMP(3);
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "lastRenovationDate"  TIMESTAMP(3);
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "fiscalValueChf"      DOUBLE PRECISION;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "insuranceValueChf"   DOUBLE PRECISION;
ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "ppeEstimateChf"      DOUBLE PRECISION;
