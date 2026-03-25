-- AlterTable: add orgId to Request with empty string default
ALTER TABLE "Request" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT '';

-- Backfill: populate orgId from the Unit → Building FK chain
UPDATE "Request" r
SET "orgId" = b."orgId"
FROM "Unit" u
JOIN "Building" b ON u."buildingId" = b.id
WHERE r."unitId" = u.id;

-- CreateIndex
CREATE INDEX "Request_orgId_idx" ON "Request"("orgId");
