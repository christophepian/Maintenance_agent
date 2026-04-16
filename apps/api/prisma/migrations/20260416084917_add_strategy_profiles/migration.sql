-- CreateEnum
CREATE TYPE "StrategyArchetype" AS ENUM ('exit_optimizer', 'yield_maximizer', 'value_builder', 'capital_preserver', 'opportunistic_repositioner');

-- CreateEnum
CREATE TYPE "StrategySource" AS ENUM ('questionnaire', 'advisor_set', 'imported', 'default_source');

-- CreateEnum
CREATE TYPE "RoleIntent" AS ENUM ('sell', 'income', 'long_term_quality', 'reposition', 'stable_hold', 'unspecified');

-- CreateEnum
CREATE TYPE "BuildingConditionRating" AS ENUM ('poor', 'fair', 'good', 'very_good');

-- CreateEnum
CREATE TYPE "UserDecisionStatus" AS ENUM ('accepted', 'rejected', 'deferred', 'pending');

-- CreateEnum
CREATE TYPE "DecisionOptionType" AS ENUM ('defer', 'repair', 'replace_like_for_like', 'upgrade', 'transform');

-- CreateTable
CREATE TABLE "OwnerStrategyProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "onboardingVersion" TEXT NOT NULL DEFAULT '1',
    "source" "StrategySource" NOT NULL DEFAULT 'questionnaire',
    "userFacingGoalLabel" TEXT NOT NULL,
    "dimensionsJson" TEXT NOT NULL,
    "archetypeScoresJson" TEXT NOT NULL,
    "primaryArchetype" "StrategyArchetype" NOT NULL,
    "secondaryArchetype" "StrategyArchetype",
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "contradictionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerStrategyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingStrategyProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "roleIntent" "RoleIntent" NOT NULL DEFAULT 'unspecified',
    "buildingType" TEXT,
    "approxUnits" INTEGER,
    "conditionRating" "BuildingConditionRating",
    "buildingDimensionsJson" TEXT,
    "effectiveDimensionsJson" TEXT NOT NULL,
    "archetypeScoresJson" TEXT NOT NULL,
    "primaryArchetype" "StrategyArchetype" NOT NULL,
    "secondaryArchetype" "StrategyArchetype",
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "overridesJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingStrategyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyQuestionnaireAnswer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyQuestionnaireAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerStrategyProfile_orgId_idx" ON "OwnerStrategyProfile"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStrategyProfile_ownerId_key" ON "OwnerStrategyProfile"("ownerId");

-- CreateIndex
CREATE INDEX "BuildingStrategyProfile_orgId_idx" ON "BuildingStrategyProfile"("orgId");

-- CreateIndex
CREATE INDEX "BuildingStrategyProfile_ownerProfileId_idx" ON "BuildingStrategyProfile"("ownerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingStrategyProfile_buildingId_key" ON "BuildingStrategyProfile"("buildingId");

-- CreateIndex
CREATE INDEX "StrategyQuestionnaireAnswer_orgId_idx" ON "StrategyQuestionnaireAnswer"("orgId");

-- CreateIndex
CREATE INDEX "StrategyQuestionnaireAnswer_ownerProfileId_idx" ON "StrategyQuestionnaireAnswer"("ownerProfileId");

-- AddForeignKey
ALTER TABLE "OwnerStrategyProfile" ADD CONSTRAINT "OwnerStrategyProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingStrategyProfile" ADD CONSTRAINT "BuildingStrategyProfile_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingStrategyProfile" ADD CONSTRAINT "BuildingStrategyProfile_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerStrategyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyQuestionnaireAnswer" ADD CONSTRAINT "StrategyQuestionnaireAnswer_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerStrategyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
