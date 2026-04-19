-- Remove the @default("") placeholder from Request.orgId.
-- All rows are now guaranteed to have a valid orgId (backfilled in the previous migration).
ALTER TABLE "Request" ALTER COLUMN "orgId" DROP DEFAULT;
