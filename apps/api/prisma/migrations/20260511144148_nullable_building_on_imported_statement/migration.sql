-- Make buildingId nullable on ImportedStatement so a PDF can be uploaded
-- before the building exists in the system. The manager assigns the building
-- during the review step; approval is blocked until buildingId is set.
ALTER TABLE "ImportedStatement" ALTER COLUMN "buildingId" DROP NOT NULL;
