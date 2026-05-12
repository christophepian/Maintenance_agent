-- DropForeignKey
ALTER TABLE "ImportedStatement" DROP CONSTRAINT "ImportedStatement_buildingId_fkey";

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "houseRulesText" TEXT;

-- AddForeignKey
ALTER TABLE "ImportedStatement" ADD CONSTRAINT "ImportedStatement_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
