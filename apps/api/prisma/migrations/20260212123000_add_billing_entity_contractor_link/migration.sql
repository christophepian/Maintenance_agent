-- AddColumn
ALTER TABLE "BillingEntity" ADD COLUMN "contractorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BillingEntity_contractorId_key" ON "BillingEntity"("contractorId");

-- AddForeignKey
ALTER TABLE "BillingEntity" ADD CONSTRAINT "BillingEntity_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
