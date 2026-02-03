-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING_REVIEW', 'AUTO_APPROVED');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "estimatedCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- CreateTable
CREATE TABLE "OrgConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "autoApproveLimit" INTEGER NOT NULL DEFAULT 200,

    CONSTRAINT "OrgConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgConfig_orgId_key" ON "OrgConfig"("orgId");

-- AddForeignKey
ALTER TABLE "OrgConfig" ADD CONSTRAINT "OrgConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
