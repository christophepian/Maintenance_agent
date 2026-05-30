-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "triageBudgetMax" INTEGER,
ADD COLUMN     "triageBudgetMin" INTEGER,
ADD COLUMN     "triageCompletedAt" TIMESTAMP(3),
ADD COLUMN     "triageContractorIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
