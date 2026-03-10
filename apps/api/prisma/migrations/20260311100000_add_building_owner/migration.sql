-- CreateTable
CREATE TABLE "BuildingOwner" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildingOwner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildingOwner_buildingId_idx" ON "BuildingOwner"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingOwner_userId_idx" ON "BuildingOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingOwner_buildingId_userId_key" ON "BuildingOwner"("buildingId", "userId");

-- AddForeignKey
ALTER TABLE "BuildingOwner" ADD CONSTRAINT "BuildingOwner_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingOwner" ADD CONSTRAINT "BuildingOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
