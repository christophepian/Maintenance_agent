-- CreateTable
CREATE TABLE "UnitConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "autoApproveLimit" INTEGER,
    "emergencyAutoDispatch" BOOLEAN,
    "requireOwnerApprovalAbove" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitConfig_unitId_key" ON "UnitConfig"("unitId");

-- CreateIndex
CREATE INDEX "UnitConfig_orgId_idx" ON "UnitConfig"("orgId");

-- AddForeignKey
ALTER TABLE "UnitConfig" ADD CONSTRAINT "UnitConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConfig" ADD CONSTRAINT "UnitConfig_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
