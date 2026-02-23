-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'PENDING_OWNER_APPROVAL';

-- DropForeignKey
ALTER TABLE "ApprovalRule" DROP CONSTRAINT "ApprovalRule_buildingId_fkey";

-- AlterTable
ALTER TABLE "ApprovalRule" ALTER COLUMN "conditions" DROP DEFAULT;

-- DropEnum
DROP TYPE "RuleConditionField";

-- DropEnum
DROP TYPE "RuleConditionOperator";

-- CreateIndex
CREATE INDEX "ApprovalRule_orgId_isActive_idx" ON "ApprovalRule"("orgId", "isActive");

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
