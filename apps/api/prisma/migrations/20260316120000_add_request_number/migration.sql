-- AlterTable: add auto-incrementing requestNumber to Request
-- Uses a sequence so existing rows get backfilled with unique values.

-- 1. Create a sequence
CREATE SEQUENCE IF NOT EXISTS "Request_requestNumber_seq";

-- 2. Add the column, defaulting to nextval so new rows auto-increment
ALTER TABLE "Request"
  ADD COLUMN "requestNumber" INTEGER;

-- 3. Backfill existing rows with sequential values based on creation order
UPDATE "Request"
SET "requestNumber" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "Request"
) sub
WHERE "Request".id = sub.id;

-- 4. Set NOT NULL + default + unique now that all rows have values
ALTER TABLE "Request"
  ALTER COLUMN "requestNumber" SET NOT NULL,
  ALTER COLUMN "requestNumber" SET DEFAULT nextval('"Request_requestNumber_seq"');

-- 5. Set the sequence to continue after the max existing value
SELECT setval('"Request_requestNumber_seq"', COALESCE((SELECT MAX("requestNumber") FROM "Request"), 0));

-- 6. Add unique constraint
ALTER TABLE "Request" ADD CONSTRAINT "Request_requestNumber_key" UNIQUE ("requestNumber");
