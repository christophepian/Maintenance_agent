-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('REQUEST_APPROVED', 'REQUEST_PENDING_REVIEW', 'REQUEST_PENDING_OWNER_APPROVAL', 'CONTRACTOR_ASSIGNED', 'CONTRACTOR_REJECTED', 'JOB_CREATED', 'JOB_STARTED', 'JOB_COMPLETED', 'INVOICE_CREATED', 'INVOICE_APPROVED', 'INVOICE_PAID', 'INVOICE_DISPUTED', 'OWNER_REJECTED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "message" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_orgId_userId_idx" ON "Notification"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Notification_orgId_buildingId_idx" ON "Notification"("orgId", "buildingId");

-- CreateIndex
CREATE INDEX "Notification_orgId_userId_readAt_idx" ON "Notification"("orgId", "userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_orgId_userId_entityType_entityId_eventType_key" ON "Notification"("orgId", "userId", "entityType", "entityId", "eventType");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
