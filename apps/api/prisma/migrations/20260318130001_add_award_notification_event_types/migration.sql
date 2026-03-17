-- Add new notification event types for quote award/rejection
ALTER TYPE "NotificationEventType" ADD VALUE 'QUOTE_AWARDED';
ALTER TYPE "NotificationEventType" ADD VALUE 'QUOTE_REJECTED';
