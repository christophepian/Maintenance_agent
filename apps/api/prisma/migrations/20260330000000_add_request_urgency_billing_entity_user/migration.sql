-- CreateEnum
CREATE TYPE "RequestUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');

-- AlterTable
ALTER TABLE "BillingEntity" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "urgency" "RequestUrgency" NOT NULL DEFAULT 'MEDIUM';

-- CreateIndex
CREATE UNIQUE INDEX "BillingEntity_userId_key" ON "BillingEntity"("userId");

-- AddForeignKey
ALTER TABLE "BillingEntity" ADD CONSTRAINT "BillingEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
