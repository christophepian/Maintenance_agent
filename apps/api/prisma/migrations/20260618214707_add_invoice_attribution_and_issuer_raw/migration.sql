-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "buildingId" TEXT,
ADD COLUMN     "issuerAddressLine1" TEXT,
ADD COLUMN     "issuerCity" TEXT,
ADD COLUMN     "issuerCountry" TEXT,
ADD COLUMN     "issuerName" TEXT,
ADD COLUMN     "issuerPostalCode" TEXT,
ADD COLUMN     "unitId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_buildingId_idx" ON "Invoice"("buildingId");

-- CreateIndex
CREATE INDEX "Invoice_unitId_idx" ON "Invoice"("unitId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
