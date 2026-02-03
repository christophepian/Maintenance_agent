-- AlterTable
ALTER TABLE "Request" ALTER COLUMN "estimatedCost" DROP NOT NULL,
ALTER COLUMN "estimatedCost" DROP DEFAULT;
