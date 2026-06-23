-- Add NOT_INSPECTED to ItemCondition enum.
-- Used as the seeded default for asset-baselined condition-report items;
-- an item must be rated (changed away from NOT_INSPECTED) before the report can be submitted.
ALTER TYPE "ItemCondition" ADD VALUE IF NOT EXISTS 'NOT_INSPECTED';
