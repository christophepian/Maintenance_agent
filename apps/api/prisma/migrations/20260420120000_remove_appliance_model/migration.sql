-- DropForeignKey
ALTER TABLE "Appliance" DROP CONSTRAINT "Appliance_assetModelId_fkey";

-- DropForeignKey
ALTER TABLE "Appliance" DROP CONSTRAINT "Appliance_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Appliance" DROP CONSTRAINT "Appliance_unitId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_applianceId_fkey";

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "applianceId";

-- DropTable
DROP TABLE "Appliance";
