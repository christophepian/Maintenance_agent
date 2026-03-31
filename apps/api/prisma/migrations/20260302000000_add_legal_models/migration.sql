-- Gap-filling migration: Legal Engine + DepreciationStandard tables created via db push
-- These tables existed in the DB but had no migration file.
-- This migration restores them to their initial state (before 20260308 added LegalSource.scope).

-- CreateEnum
CREATE TYPE "LegalAuthority" AS ENUM ('STATUTE', 'INDUSTRY_STANDARD');

-- CreateEnum
CREATE TYPE "LegalRuleType" AS ENUM ('MAINTENANCE_OBLIGATION', 'DEPRECIATION', 'RENT_INDEXATION', 'RENT_REDUCTION', 'TERMINATION_DEADLINE');

-- CreateEnum
CREATE TYPE "LegalRuleScope" AS ENUM ('FEDERAL', 'CANTONAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "LegalObligation" AS ENUM ('OBLIGATED', 'DISCRETIONARY', 'TENANT_RESPONSIBLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LegalSourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- NOTE: LegalSourceScope is created by 20260308_add_legal_source_scope (not here)

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('APPLIANCE', 'FIXTURE', 'FINISH', 'STRUCTURAL', 'SYSTEM', 'OTHER');

-- CreateTable: LegalSource (initial state — without scope column, added by 20260308_add_legal_source_scope)
CREATE TABLE "LegalSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CH',
    "url" TEXT,
    "updateFrequency" TEXT,
    "fetcherType" TEXT,
    "parserType" TEXT,
    "status" "LegalSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LegalVariable
CREATE TABLE "LegalVariable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CH',
    "canton" TEXT,
    "unit" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LegalVariableVersion
CREATE TABLE "LegalVariableVersion" (
    "id" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "valueJson" JSONB NOT NULL,
    "sourceId" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalVariableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LegalRule
CREATE TABLE "LegalRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ruleType" "LegalRuleType" NOT NULL,
    "authority" "LegalAuthority" NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CH',
    "canton" TEXT,
    "topic" TEXT,
    "scope" "LegalRuleScope" NOT NULL DEFAULT 'FEDERAL',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LegalRuleVersion
CREATE TABLE "LegalRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "dslJson" JSONB NOT NULL,
    "citationsJson" JSONB,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LegalEvaluationLog
CREATE TABLE "LegalEvaluationLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT,
    "unitId" TEXT,
    "requestId" TEXT,
    "contextJson" JSONB NOT NULL,
    "contextHash" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "matchedRuleVersionIdsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalEvaluationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LegalCategoryMapping
CREATE TABLE "LegalCategoryMapping" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "requestCategory" TEXT NOT NULL,
    "legalTopic" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LegalCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DepreciationStandard
CREATE TABLE "DepreciationStandard" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CH',
    "canton" TEXT,
    "authority" "LegalAuthority" NOT NULL DEFAULT 'INDUSTRY_STANDARD',
    "assetType" "AssetType" NOT NULL,
    "topic" TEXT NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "notes" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepreciationStandard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalSource_jurisdiction_idx" ON "LegalSource"("jurisdiction");
CREATE INDEX "LegalSource_status_idx" ON "LegalSource"("status");

CREATE UNIQUE INDEX "LegalVariable_key_jurisdiction_canton_key" ON "LegalVariable"("key", "jurisdiction", "canton");
CREATE INDEX "LegalVariable_jurisdiction_idx" ON "LegalVariable"("jurisdiction");

CREATE INDEX "LegalVariableVersion_variableId_effectiveFrom_idx" ON "LegalVariableVersion"("variableId", "effectiveFrom");
CREATE INDEX "LegalVariableVersion_sourceId_idx" ON "LegalVariableVersion"("sourceId");

CREATE UNIQUE INDEX "LegalRule_key_key" ON "LegalRule"("key");
CREATE INDEX "LegalRule_ruleType_jurisdiction_idx" ON "LegalRule"("ruleType", "jurisdiction");
CREATE INDEX "LegalRule_isActive_idx" ON "LegalRule"("isActive");

CREATE INDEX "LegalRuleVersion_ruleId_effectiveFrom_idx" ON "LegalRuleVersion"("ruleId", "effectiveFrom");

CREATE INDEX "LegalEvaluationLog_orgId_idx" ON "LegalEvaluationLog"("orgId");
CREATE INDEX "LegalEvaluationLog_requestId_idx" ON "LegalEvaluationLog"("requestId");
CREATE INDEX "LegalEvaluationLog_contextHash_idx" ON "LegalEvaluationLog"("contextHash");

CREATE UNIQUE INDEX "LegalCategoryMapping_orgId_requestCategory_key" ON "LegalCategoryMapping"("orgId", "requestCategory");
CREATE INDEX "LegalCategoryMapping_requestCategory_idx" ON "LegalCategoryMapping"("requestCategory");
CREATE INDEX "LegalCategoryMapping_isActive_idx" ON "LegalCategoryMapping"("isActive");

CREATE UNIQUE INDEX "DepreciationStandard_jurisdiction_canton_assetType_topic_key" ON "DepreciationStandard"("jurisdiction", "canton", "assetType", "topic");
CREATE INDEX "DepreciationStandard_assetType_topic_idx" ON "DepreciationStandard"("assetType", "topic");

-- AddForeignKey
ALTER TABLE "LegalVariableVersion" ADD CONSTRAINT "LegalVariableVersion_variableId_fkey"
    FOREIGN KEY ("variableId") REFERENCES "LegalVariable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalVariableVersion" ADD CONSTRAINT "LegalVariableVersion_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalRuleVersion" ADD CONSTRAINT "LegalRuleVersion_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "LegalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalEvaluationLog" ADD CONSTRAINT "LegalEvaluationLog_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalCategoryMapping" ADD CONSTRAINT "LegalCategoryMapping_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepreciationStandard" ADD CONSTRAINT "DepreciationStandard_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
