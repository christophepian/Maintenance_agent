-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('MAINTENANCE', 'COMPLAINT', 'ADMINISTRATIVE');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "requestType" "RequestType" NOT NULL DEFAULT 'MAINTENANCE',
ADD COLUMN     "resolutionNote" TEXT;
