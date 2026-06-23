-- AddInvoiceCostNature: classify incoming invoices as CHARGE (Nebenkosten → cost
-- pool) or DIRECT (ledger/billing flow) at the review gate, and carry the chosen
-- ancillary charge category on the invoice. See docs/ANCILLARY_COSTS_V3_REMEDIATION.md.

-- CreateEnum
CREATE TYPE "CostNature" AS ENUM ('CHARGE', 'DIRECT');

-- AlterTable (additive, nullable — no backfill needed)
ALTER TABLE "Invoice" ADD COLUMN "costNature" "CostNature";
ALTER TABLE "Invoice" ADD COLUMN "ancillaryCategoryId" TEXT;

-- ForeignKey: invoice → ancillary charge category (SetNull so deleting a category
-- never deletes invoices)
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_ancillaryCategoryId_fkey"
  FOREIGN KEY ("ancillaryCategoryId") REFERENCES "AncillaryCostCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Invoice_ancillaryCategoryId_idx" ON "Invoice"("ancillaryCategoryId");
