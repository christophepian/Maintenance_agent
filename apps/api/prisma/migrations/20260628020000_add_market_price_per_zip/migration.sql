-- Reference market purchase price per m², keyed by postal code, per org.
-- Manually maintained / seeded (not live-scraped). Drives a "market estimate"
-- reference shown alongside the unit valeur intrinsèque worksheet.
CREATE TABLE "MarketPricePerZip" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "postalCode"     TEXT NOT NULL,
  "city"           TEXT,
  "pricePerSqmChf" DOUBLE PRECISION NOT NULL,
  "source"         TEXT,
  "asOf"           TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketPricePerZip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketPricePerZip_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MarketPricePerZip_orgId_postalCode_key" ON "MarketPricePerZip"("orgId", "postalCode");
CREATE INDEX "MarketPricePerZip_orgId_idx" ON "MarketPricePerZip"("orgId");

-- Block direct PostgREST access; backend connects via service_role (BYPASSRLS).
ALTER TABLE "MarketPricePerZip" ENABLE ROW LEVEL SECURITY;
