-- CreateEnum
CREATE TYPE "RuleConditionField" AS ENUM ('CATEGORY', 'ESTIMATED_COST', 'UNIT_TYPE');

-- CreateEnum
CREATE TYPE "RuleConditionOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('AUTO_APPROVE', 'REQUIRE_MANAGER_REVIEW', 'REQUIRE_OWNER_APPROVAL');

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "action" "RuleAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRule_orgId_buildingId_priority_idx" ON "ApprovalRule"("orgId", "buildingId", "priority");

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "BuildingConfig"("buildingId") ON DELETE CASCADE ON UPDATE CASCADE;
