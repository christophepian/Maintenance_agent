-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'ASSIGNED';

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "contractorNotes" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "requestId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_orgId_createdAt_idx" ON "Event"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_requestId_idx" ON "Event"("requestId");
