-- AddInvoiceLineChargeAdvance: tag the charges (acompte) portion of rent invoices (v2 C3)
-- See docs/ANCILLARY_COSTS_RECONCILIATION.md
ALTER TABLE "InvoiceLineItem" ADD COLUMN "isChargeAdvance" BOOLEAN NOT NULL DEFAULT false;
