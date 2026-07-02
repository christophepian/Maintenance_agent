-- Parking units: a parking spot / garage becomes a first-class Unit (type=PARKING),
-- optionally linked to the flat it is by default assigned to (linkedFlatId). The
-- link drives default-tenant + co-billing; the spot can still be leased to a third
-- party. parkingKind distinguishes an exterior spot from an enclosed garage/box.

-- New enum value on UnitType. (PG12+ allows ADD VALUE in a transaction as long as
-- the value is not used in the same transaction — it isn't here.)
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'PARKING';

-- New enum for the parking sub-kind.
DO $$ BEGIN
  CREATE TYPE "ParkingKind" AS ENUM ('EXTERIOR', 'GARAGE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Columns (nullable, no defaults — non-breaking).
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "parkingKind"  "ParkingKind";
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "linkedFlatId" TEXT;

-- Self-referencing FK: deleting a flat nulls its parking links (spots survive).
DO $$ BEGIN
  ALTER TABLE "Unit" ADD CONSTRAINT "Unit_linkedFlatId_fkey"
    FOREIGN KEY ("linkedFlatId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Unit_linkedFlatId_idx" ON "Unit"("linkedFlatId");
