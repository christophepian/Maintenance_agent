-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('EQUIPMENT', 'COMPONENT');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "category" "AssetCategory" NOT NULL DEFAULT 'EQUIPMENT';

-- Backfill: derive category from assetType deterministically
-- FINISH, STRUCTURAL, SYSTEM → COMPONENT; APPLIANCE, FIXTURE, OTHER → EQUIPMENT (default)
UPDATE "Asset" SET "category" = 'COMPONENT' WHERE "type" IN ('FINISH', 'STRUCTURAL', 'SYSTEM');
