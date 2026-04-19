-- Step 0: direct backfill — all remaining empty-string rows belong to default-org
-- (safe: single-org system; all 238 orphaned rows have no FK chain to traverse)
UPDATE "Request" SET "orgId" = 'default-org' WHERE "orgId" = '';

-- Backfill Request.orgId from FK chain before adding FK constraint.
-- Rows with orgId = '' (the @default("") placeholder) are populated via:
--   1. unit → building → org  (covers the vast majority of requests)
--   2. tenant → org           (fallback for requests without unitId)
--   3. contractor → org       (fallback for contractor-only requests)

-- Step 1: backfill via unit → building → org
UPDATE "Request"
SET "orgId" = (
  SELECT b."orgId"
  FROM "Unit" u
  JOIN "Building" b ON u."buildingId" = b.id
  WHERE u.id = "Request"."unitId"
)
WHERE "unitId" IS NOT NULL AND "orgId" = '';

-- Step 2: backfill via tenant → org
UPDATE "Request"
SET "orgId" = (SELECT "orgId" FROM "Tenant" WHERE id = "Request"."tenantId")
WHERE "tenantId" IS NOT NULL AND "orgId" = '';

-- Step 3: backfill via contractor → org
UPDATE "Request"
SET "orgId" = (SELECT "orgId" FROM "Contractor" WHERE id = "Request"."assignedContractorId")
WHERE "assignedContractorId" IS NOT NULL AND "orgId" = '';

-- AddForeignKey (safe now that all rows have a valid orgId)
ALTER TABLE "Request" ADD CONSTRAINT "Request_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
