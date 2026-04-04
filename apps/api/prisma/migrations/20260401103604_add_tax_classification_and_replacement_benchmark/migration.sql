-- CreateEnum
CREATE TYPE "TaxClassification" AS ENUM ('WERTERHALTEND', 'WERTVERMEHREND', 'MIXED');

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CH',
    "canton" TEXT,
    "assetType" "AssetType" NOT NULL,
    "topic" TEXT NOT NULL,
    "scope" "LegalRuleScope" NOT NULL DEFAULT 'FEDERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "classification" "TaxClassification" NOT NULL,
    "deductiblePct" INTEGER NOT NULL DEFAULT 100,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "notes" TEXT,
    "citationsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplacementBenchmark" (
    "id" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "topic" TEXT NOT NULL,
    "lowChf" INTEGER NOT NULL,
    "medianChf" INTEGER NOT NULL,
    "highChf" INTEGER NOT NULL,
    "sourceNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplacementBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRule_assetType_topic_idx" ON "TaxRule"("assetType", "topic");

-- CreateIndex
CREATE INDEX "TaxRule_canton_idx" ON "TaxRule"("canton");

-- CreateIndex
CREATE INDEX "TaxRule_isActive_idx" ON "TaxRule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_jurisdiction_canton_assetType_topic_key" ON "TaxRule"("jurisdiction", "canton", "assetType", "topic");

-- CreateIndex
CREATE INDEX "TaxRuleVersion_ruleId_effectiveFrom_idx" ON "TaxRuleVersion"("ruleId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ReplacementBenchmark_assetType_idx" ON "ReplacementBenchmark"("assetType");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementBenchmark_assetType_topic_key" ON "ReplacementBenchmark"("assetType", "topic");

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
