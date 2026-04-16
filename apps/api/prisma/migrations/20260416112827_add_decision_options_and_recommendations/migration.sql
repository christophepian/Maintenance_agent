-- CreateTable
CREATE TABLE "MaintenanceDecisionOption" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "optionType" "DecisionOptionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedUsefulLifeYears" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "implementationMonths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tenantDisruptionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskReductionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "complianceCoverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saleAttractivenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rentUpliftScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opexReductionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifecycleExtensionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modernizationImpactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalValueCreationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uncertaintyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxProfileJson" TEXT,
    "financialProjectionJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceDecisionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationResult" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "buildingProfileId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedOptionId" TEXT NOT NULL,
    "rankedOptionsJson" TEXT NOT NULL,
    "explanationJson" TEXT NOT NULL,
    "userDecision" "UserDecisionStatus" NOT NULL DEFAULT 'pending',
    "userDecidedAt" TIMESTAMP(3),
    "userFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceDecisionOption_orgId_idx" ON "MaintenanceDecisionOption"("orgId");

-- CreateIndex
CREATE INDEX "MaintenanceDecisionOption_opportunityId_idx" ON "MaintenanceDecisionOption"("opportunityId");

-- CreateIndex
CREATE INDEX "RecommendationResult_orgId_idx" ON "RecommendationResult"("orgId");

-- CreateIndex
CREATE INDEX "RecommendationResult_opportunityId_idx" ON "RecommendationResult"("opportunityId");

-- CreateIndex
CREATE INDEX "RecommendationResult_buildingProfileId_idx" ON "RecommendationResult"("buildingProfileId");

-- AddForeignKey
ALTER TABLE "MaintenanceDecisionOption" ADD CONSTRAINT "MaintenanceDecisionOption_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "MaintenanceDecisionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_buildingProfileId_fkey" FOREIGN KEY ("buildingProfileId") REFERENCES "BuildingStrategyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
