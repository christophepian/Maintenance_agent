-- Add per-asset useful life override (tier 1 in depreciation resolution)
ALTER TABLE "Asset" ADD COLUMN "usefulLifeOverrideMonths" INTEGER;

-- Add default useful life on AssetModel (tier 2 in depreciation resolution)
ALTER TABLE "AssetModel" ADD COLUMN "defaultUsefulLifeMonths" INTEGER;
