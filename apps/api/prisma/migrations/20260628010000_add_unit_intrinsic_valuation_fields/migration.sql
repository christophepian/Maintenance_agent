-- Unit: valeur intrinsèque worksheet inputs. Habitation/garden are valued from
-- the existing livingAreaSqm × prix au m²; vétusté is a % discount; parking and
-- garage are flat lines. The intrinsic value itself is computed, not stored.
-- All nullable, no defaults — non-breaking.
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "intrinsicPricePerSqmChf" DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "vetustePct"              DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "gardenAreaSqm"           DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "gardenWeightPct"         DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "extParkingValueChf"      DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "garageValueChf"          DOUBLE PRECISION;
