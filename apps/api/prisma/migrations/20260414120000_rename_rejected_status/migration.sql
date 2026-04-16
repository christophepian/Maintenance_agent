-- Rename OWNER_REJECTED to REJECTED across all enums that use it.
-- This supports the new generic rejection model where both managers
-- and owners can reject a request.

ALTER TYPE "RequestStatus" RENAME VALUE 'OWNER_REJECTED' TO 'REJECTED';
ALTER TYPE "ApprovalSource" RENAME VALUE 'OWNER_REJECTED' TO 'REJECTED';
ALTER TYPE "RequestEventType" RENAME VALUE 'OWNER_REJECTED' TO 'REJECTED';
ALTER TYPE "NotificationEventType" RENAME VALUE 'OWNER_REJECTED' TO 'REJECTED';
