-- Backfill: collapse AUTO_APPROVED requests into APPROVED.
-- AUTO_APPROVED was removed by commit ad19394 (2026-04-25) — threshold checks
-- now happen at quote award time (awardQuoteWorkflow) rather than at request
-- creation. This migration removes the orphan enum value and migrates any
-- legacy rows. No information is lost: APPROVED is the canonical post-approval
-- state regardless of who/what approved it (system, owner, manager, legal engine).
UPDATE "Request" SET status = 'APPROVED' WHERE status = 'AUTO_APPROVED';

-- AlterEnum: remove AUTO_APPROVED from RequestStatus
BEGIN;
CREATE TYPE "RequestStatus_new" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'RFP_PENDING', 'COMPLETED', 'ASSIGNED', 'PENDING_OWNER_APPROVAL', 'REJECTED');
ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "status" TYPE "RequestStatus_new" USING ("status"::text::"RequestStatus_new");
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "RequestStatus_old";
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
COMMIT;
