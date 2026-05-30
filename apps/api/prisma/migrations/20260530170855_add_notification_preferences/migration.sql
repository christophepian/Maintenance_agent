-- DropForeignKey
ALTER TABLE "Building" DROP CONSTRAINT "Building_managerId_fkey";

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_orgId_idx" ON "NotificationPreference"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_orgId_eventType_key" ON "NotificationPreference"("userId", "orgId", "eventType");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
