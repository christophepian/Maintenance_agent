-- Assign a dedicated property manager to each building.
-- One manager per building (nullable); NULL = unassigned (visible to DB admin only).
-- The foreign key uses SET NULL on delete so removing a user does not cascade-delete buildings.

ALTER TABLE "Building"
  ADD COLUMN "managerId" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

CREATE INDEX "Building_managerId_idx" ON "Building"("managerId");
