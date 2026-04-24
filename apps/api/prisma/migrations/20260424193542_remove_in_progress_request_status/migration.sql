-- Backfill: move IN_PROGRESS requests to ASSIGNED.
-- The linked Job already carries IN_PROGRESS in Job.status — no information is lost.
UPDATE "Request" SET status = 'ASSIGNED' WHERE status = 'IN_PROGRESS';

-- AlterEnum: remove IN_PROGRESS from RequestStatus
BEGIN;
CREATE TYPE "RequestStatus_new" AS ENUM ('PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'RFP_PENDING', 'COMPLETED', 'ASSIGNED', 'PENDING_OWNER_APPROVAL', 'REJECTED');
ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "status" TYPE "RequestStatus_new" USING ("status"::text::"RequestStatus_new");
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "RequestStatus_old";
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
COMMIT;
