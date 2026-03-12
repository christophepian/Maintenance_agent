-- CreateEnum: PayingParty
CREATE TYPE "PayingParty" AS ENUM ('LANDLORD', 'TENANT');

-- AlterTable: add payingParty to Request with default LANDLORD
ALTER TABLE "Request" ADD COLUMN "payingParty" "PayingParty" NOT NULL DEFAULT 'LANDLORD';

-- AlterEnum: add TENANT_SELF_PAY_ACCEPTED to NotificationEventType
ALTER TYPE "NotificationEventType" ADD VALUE 'TENANT_SELF_PAY_ACCEPTED';
