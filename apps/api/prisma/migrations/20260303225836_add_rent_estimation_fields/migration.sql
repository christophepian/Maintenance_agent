-- CreateEnum
CREATE TYPE "LocationSegment" AS ENUM ('PRIME', 'STANDARD', 'PERIPHERY');

-- CreateEnum
CREATE TYPE "InsulationQuality" AS ENUM ('UNKNOWN', 'POOR', 'AVERAGE', 'GOOD', 'EXCELLENT');

-- CreateEnum
CREATE TYPE "EnergyLabel" AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G');

-- CreateEnum
CREATE TYPE "HeatingType" AS ENUM ('HEAT_PUMP', 'DISTRICT', 'GAS', 'OIL', 'ELECTRIC', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "hasConcierge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasElevator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "yearBuilt" INTEGER;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "energyLabel" "EnergyLabel",
ADD COLUMN     "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasParking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasTerrace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "heatingType" "HeatingType",
ADD COLUMN     "insulationQuality" "InsulationQuality",
ADD COLUMN     "lastRenovationYear" INTEGER,
ADD COLUMN     "livingAreaSqm" DOUBLE PRECISION,
ADD COLUMN     "locationSegment" "LocationSegment",
ADD COLUMN     "rooms" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RentEstimationConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "canton" TEXT,
    "baseRentPerSqmChfMonthly" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "locationCoefPrime" DOUBLE PRECISION NOT NULL DEFAULT 1.30,
    "locationCoefStandard" DOUBLE PRECISION NOT NULL DEFAULT 1.00,
    "locationCoefPeriphery" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "ageCoefNew" DOUBLE PRECISION NOT NULL DEFAULT 1.10,
    "ageCoefMid" DOUBLE PRECISION NOT NULL DEFAULT 1.00,
    "ageCoefOld" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "ageCoefVeryOld" DOUBLE PRECISION NOT NULL DEFAULT 0.90,
    "energyCoefJson" JSONB NOT NULL DEFAULT '{"A":1.05,"B":1.03,"C":1.01,"D":1.00,"E":0.98,"F":0.95,"G":0.90}',
    "chargesBaseOptimistic" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "chargesBasePessimistic" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "heatingChargeAdjJson" JSONB NOT NULL DEFAULT '{"HEAT_PUMP":-0.02,"DISTRICT":-0.01,"GAS":0,"OIL":0.02,"ELECTRIC":0.03,"UNKNOWN":0}',
    "serviceChargeAdjElevator" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "serviceChargeAdjConcierge" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "chargesMinClamp" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "chargesMaxClamp" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentEstimationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentEstimationConfig_orgId_idx" ON "RentEstimationConfig"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RentEstimationConfig_orgId_canton_key" ON "RentEstimationConfig"("orgId", "canton");

-- AddForeignKey
ALTER TABLE "RentEstimationConfig" ADD CONSTRAINT "RentEstimationConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

