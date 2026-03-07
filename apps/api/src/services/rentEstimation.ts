/**
 * Rent Estimation Service
 *
 * Pure estimation algorithm + persistence layer for Swiss portfolio-level
 * monthly rent and charges estimation using configurable coefficients.
 *
 * Minimum required input: livingAreaSqm + orgId.
 * Optional improvements: locationSegment, yearBuilt, lastRenovationYear,
 * energyLabel, heatingType, hasElevator, hasConcierge.
 */

import { PrismaClient, Prisma, LocationSegment, EnergyLabel, HeatingType } from "@prisma/client";
import prisma from "./prismaClient";

/* ══════════════════════════════════════════════════════════════
   DTOs
   ══════════════════════════════════════════════════════════════ */

export interface AppliedCoefficients {
  baseRentPerSqm: number;
  locationCoef: number;
  ageCoef: number;
  energyCoef: number;
  chargesRateOptimistic: number;
  chargesRatePessimistic: number;
  heatingAdj: number;
  serviceAdj: number;
  clampsApplied?: { optimistic?: boolean; pessimistic?: boolean };
}

export interface EstimationInputsUsed {
  livingAreaSqm: number;
  segment: string;
  effectiveYear: number | null;
  energyLabel: string | null;
  heatingType: string | null;
  hasElevator: boolean;
  hasConcierge: boolean;
}

export interface RentEstimateDTO {
  unitId: string;
  netRentChfMonthly: number;
  chargesOptimisticChfMonthly: number;
  chargesPessimisticChfMonthly: number;
  totalOptimisticChfMonthly: number;
  totalPessimisticChfMonthly: number;
  appliedCoefficients: AppliedCoefficients;
  inputsUsed: EstimationInputsUsed;
  warnings: string[];
}

export interface RentEstimationConfigDTO {
  id: string;
  orgId: string;
  canton: string | null;
  baseRentPerSqmChfMonthly: number;
  locationCoefPrime: number;
  locationCoefStandard: number;
  locationCoefPeriphery: number;
  ageCoefNew: number;
  ageCoefMid: number;
  ageCoefOld: number;
  ageCoefVeryOld: number;
  energyCoefJson: Record<string, number>;
  chargesBaseOptimistic: number;
  chargesBasePessimistic: number;
  heatingChargeAdjJson: Record<string, number>;
  serviceChargeAdjElevator: number;
  serviceChargeAdjConcierge: number;
  chargesMinClamp: number;
  chargesMaxClamp: number;
  createdAt: string;
  updatedAt: string;
}

/* ══════════════════════════════════════════════════════════════
   Canonical Include / Select (G9)
   ══════════════════════════════════════════════════════════════ */

/** Select only the fields needed for rent estimation from Unit + Building */
export const UNIT_RENT_ESTIMATE_SELECT = {
  id: true,
  orgId: true,
  livingAreaSqm: true,
  rooms: true,
  floor: true,
  hasBalcony: true,
  hasTerrace: true,
  hasParking: true,
  locationSegment: true,
  lastRenovationYear: true,
  insulationQuality: true,
  energyLabel: true,
  heatingType: true,
  building: {
    select: {
      yearBuilt: true,
      hasElevator: true,
      hasConcierge: true,
    },
  },
} satisfies Prisma.UnitSelect;

/* ══════════════════════════════════════════════════════════════
   Pure Estimation Algorithm
   ══════════════════════════════════════════════════════════════ */

export interface EstimationInputs {
  unitId: string;
  livingAreaSqm: number;
  locationSegment?: LocationSegment | null;
  yearBuilt?: number | null;
  lastRenovationYear?: number | null;
  energyLabel?: EnergyLabel | null;
  heatingType?: HeatingType | null;
  hasElevator: boolean;
  hasConcierge: boolean;
}

export interface EstimationConfig {
  baseRentPerSqmChfMonthly: number;
  locationCoefPrime: number;
  locationCoefStandard: number;
  locationCoefPeriphery: number;
  ageCoefNew: number;
  ageCoefMid: number;
  ageCoefOld: number;
  ageCoefVeryOld: number;
  energyCoefJson: Record<string, number>;
  chargesBaseOptimistic: number;
  chargesBasePessimistic: number;
  heatingChargeAdjJson: Record<string, number>;
  serviceChargeAdjElevator: number;
  serviceChargeAdjConcierge: number;
  chargesMinClamp: number;
  chargesMaxClamp: number;
}

/**
 * Pure function: compute rent estimate from inputs + config.
 * No DB access, fully testable.
 */
export function computeRentEstimate(
  inputs: EstimationInputs,
  config: EstimationConfig,
): RentEstimateDTO {
  const warnings: string[] = [];
  const now = new Date().getFullYear();

  // --- Location coefficient ---
  let locationCoef = config.locationCoefStandard;
  let segmentUsed = "STANDARD";
  if (inputs.locationSegment) {
    segmentUsed = inputs.locationSegment;
    switch (inputs.locationSegment) {
      case "PRIME":
        locationCoef = config.locationCoefPrime;
        break;
      case "PERIPHERY":
        locationCoef = config.locationCoefPeriphery;
        break;
      default:
        locationCoef = config.locationCoefStandard;
    }
  } else {
    warnings.push("locationSegment missing; defaulting to STANDARD");
  }

  // --- Age coefficient ---
  const effectiveYear = Math.max(
    inputs.yearBuilt ?? 0,
    inputs.lastRenovationYear ?? 0,
  ) || null;

  let ageCoef = config.ageCoefMid; // default
  if (effectiveYear) {
    const age = now - effectiveYear;
    if (age <= 10) ageCoef = config.ageCoefNew;
    else if (age <= 30) ageCoef = config.ageCoefMid;
    else if (age <= 50) ageCoef = config.ageCoefOld;
    else ageCoef = config.ageCoefVeryOld;
  } else {
    warnings.push("yearBuilt/lastRenovationYear missing; defaulting to mid age coefficient");
  }

  // --- Energy coefficient ---
  let energyCoef = 1.0;
  if (inputs.energyLabel) {
    const coefMap = config.energyCoefJson as Record<string, number>;
    energyCoef = coefMap[inputs.energyLabel] ?? 1.0;
  } else {
    warnings.push("energyLabel missing; defaulting to 1.0");
  }

  // --- Net rent ---
  const netRentRaw =
    inputs.livingAreaSqm *
    config.baseRentPerSqmChfMonthly *
    locationCoef *
    ageCoef *
    energyCoef;
  const netRentChfMonthly = Math.round(netRentRaw);

  // --- Charges ---
  const heatingAdjMap = config.heatingChargeAdjJson as Record<string, number>;
  const heatingAdj = inputs.heatingType
    ? (heatingAdjMap[inputs.heatingType] ?? 0)
    : 0;
  if (!inputs.heatingType) {
    warnings.push("heatingType missing; defaulting to 0 heating adjustment");
  }

  const serviceAdj =
    (inputs.hasElevator ? config.serviceChargeAdjElevator : 0) +
    (inputs.hasConcierge ? config.serviceChargeAdjConcierge : 0);

  let rateOptimistic = config.chargesBaseOptimistic + heatingAdj + serviceAdj;
  let ratePessimistic = config.chargesBasePessimistic + heatingAdj + serviceAdj;

  const clampsApplied: { optimistic?: boolean; pessimistic?: boolean } = {};

  if (rateOptimistic < config.chargesMinClamp) {
    rateOptimistic = config.chargesMinClamp;
    clampsApplied.optimistic = true;
  }
  if (rateOptimistic > config.chargesMaxClamp) {
    rateOptimistic = config.chargesMaxClamp;
    clampsApplied.optimistic = true;
  }
  if (ratePessimistic < config.chargesMinClamp) {
    ratePessimistic = config.chargesMinClamp;
    clampsApplied.pessimistic = true;
  }
  if (ratePessimistic > config.chargesMaxClamp) {
    ratePessimistic = config.chargesMaxClamp;
    clampsApplied.pessimistic = true;
  }

  const chargesOptimistic = Math.round(netRentChfMonthly * rateOptimistic);
  const chargesPessimistic = Math.round(netRentChfMonthly * ratePessimistic);

  return {
    unitId: inputs.unitId,
    netRentChfMonthly,
    chargesOptimisticChfMonthly: chargesOptimistic,
    chargesPessimisticChfMonthly: chargesPessimistic,
    totalOptimisticChfMonthly: netRentChfMonthly + chargesOptimistic,
    totalPessimisticChfMonthly: netRentChfMonthly + chargesPessimistic,
    appliedCoefficients: {
      baseRentPerSqm: config.baseRentPerSqmChfMonthly,
      locationCoef,
      ageCoef,
      energyCoef,
      chargesRateOptimistic: rateOptimistic,
      chargesRatePessimistic: ratePessimistic,
      heatingAdj,
      serviceAdj,
      ...(Object.keys(clampsApplied).length > 0 ? { clampsApplied } : {}),
    },
    inputsUsed: {
      livingAreaSqm: inputs.livingAreaSqm,
      segment: segmentUsed,
      effectiveYear,
      energyLabel: inputs.energyLabel ?? null,
      heatingType: inputs.heatingType ?? null,
      hasElevator: inputs.hasElevator,
      hasConcierge: inputs.hasConcierge,
    },
    warnings,
  };
}

/* ══════════════════════════════════════════════════════════════
   Config Mapper
   ══════════════════════════════════════════════════════════════ */

function mapConfigToDTO(config: any): RentEstimationConfigDTO {
  return {
    id: config.id,
    orgId: config.orgId,
    canton: config.canton ?? null,
    baseRentPerSqmChfMonthly: config.baseRentPerSqmChfMonthly,
    locationCoefPrime: config.locationCoefPrime,
    locationCoefStandard: config.locationCoefStandard,
    locationCoefPeriphery: config.locationCoefPeriphery,
    ageCoefNew: config.ageCoefNew,
    ageCoefMid: config.ageCoefMid,
    ageCoefOld: config.ageCoefOld,
    ageCoefVeryOld: config.ageCoefVeryOld,
    energyCoefJson: config.energyCoefJson as Record<string, number>,
    chargesBaseOptimistic: config.chargesBaseOptimistic,
    chargesBasePessimistic: config.chargesBasePessimistic,
    heatingChargeAdjJson: config.heatingChargeAdjJson as Record<string, number>,
    serviceChargeAdjElevator: config.serviceChargeAdjElevator,
    serviceChargeAdjConcierge: config.serviceChargeAdjConcierge,
    chargesMinClamp: config.chargesMinClamp,
    chargesMaxClamp: config.chargesMaxClamp,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

/* ══════════════════════════════════════════════════════════════
   Persistence & Retrieval
   ══════════════════════════════════════════════════════════════ */

/**
 * Get effective config for an org + optional canton.
 * Canton override wins if present, otherwise falls back to org default (canton=null).
 * If no config exists at all, auto-creates one with sensible defaults.
 */
export async function getEffectiveRentEstimationConfig(
  orgId: string,
  canton?: string | null,
): Promise<RentEstimationConfigDTO> {
  // Try canton-specific first
  if (canton) {
    const cantonConfig = await prisma.rentEstimationConfig.findUnique({
      where: { orgId_canton: { orgId, canton } },
    });
    if (cantonConfig) return mapConfigToDTO(cantonConfig);
  }

  // Fall back to org default (canton = null)
  const defaultConfig = await prisma.rentEstimationConfig.findFirst({
    where: { orgId, canton: null },
  });
  if (defaultConfig) return mapConfigToDTO(defaultConfig);

  // Auto-create default config if none exists
  const created = await prisma.rentEstimationConfig.create({
    data: { orgId, canton: null },
  });
  return mapConfigToDTO(created);
}

/**
 * Upsert a rent estimation config for an org (optionally per canton).
 * Handles the null-canton case separately since Prisma composite
 * unique where clauses don't support null values.
 */
export async function upsertRentEstimationConfig(
  orgId: string,
  canton: string | null,
  payload: Partial<EstimationConfig>,
): Promise<RentEstimationConfigDTO> {
  const data: any = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) data[key] = value;
  }

  if (canton) {
    // Canton is non-null → composite unique works
    const config = await prisma.rentEstimationConfig.upsert({
      where: { orgId_canton: { orgId, canton } },
      create: { orgId, canton, ...data },
      update: data,
    });
    return mapConfigToDTO(config);
  }

  // Canton is null → use findFirst + create/update
  const existing = await prisma.rentEstimationConfig.findFirst({
    where: { orgId, canton: null },
  });

  if (existing) {
    const config = await prisma.rentEstimationConfig.update({
      where: { id: existing.id },
      data,
    });
    return mapConfigToDTO(config);
  }

  const config = await prisma.rentEstimationConfig.create({
    data: { orgId, canton: null, ...data },
  });
  return mapConfigToDTO(config);
}

/**
 * Estimate rent for a single unit.
 * Asserts org scope (unit.orgId must match).
 */
export async function estimateRentForUnit(
  orgId: string,
  unitId: string,
): Promise<RentEstimateDTO> {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, orgId },
    select: UNIT_RENT_ESTIMATE_SELECT,
  });

  if (!unit) throw new Error("UNIT_NOT_FOUND");
  if (!unit.livingAreaSqm) throw new Error("MISSING_LIVING_AREA");

  const config = await getEffectiveRentEstimationConfig(orgId);

  const inputs: EstimationInputs = {
    unitId: unit.id,
    livingAreaSqm: unit.livingAreaSqm,
    locationSegment: unit.locationSegment,
    yearBuilt: unit.building?.yearBuilt,
    lastRenovationYear: unit.lastRenovationYear,
    energyLabel: unit.energyLabel,
    heatingType: unit.heatingType,
    hasElevator: unit.building?.hasElevator ?? false,
    hasConcierge: unit.building?.hasConcierge ?? false,
  };

  return computeRentEstimate(inputs, config);
}

/**
 * Bulk estimate rent for multiple units (by IDs or by building).
 */
export async function bulkEstimateRent(
  orgId: string,
  params: { unitIds?: string[]; buildingId?: string },
): Promise<RentEstimateDTO[]> {
  const where: Prisma.UnitWhereInput = { orgId };
  if (params.unitIds?.length) {
    where.id = { in: params.unitIds };
  } else if (params.buildingId) {
    where.buildingId = params.buildingId;
  } else {
    throw new Error("Provide unitIds or buildingId");
  }

  const units = await prisma.unit.findMany({
    where,
    select: UNIT_RENT_ESTIMATE_SELECT,
  });

  const config = await getEffectiveRentEstimationConfig(orgId);
  const results: RentEstimateDTO[] = [];

  for (const unit of units) {
    if (!unit.livingAreaSqm) {
      // Skip units without livingAreaSqm, or include with warning
      results.push({
        unitId: unit.id,
        netRentChfMonthly: 0,
        chargesOptimisticChfMonthly: 0,
        chargesPessimisticChfMonthly: 0,
        totalOptimisticChfMonthly: 0,
        totalPessimisticChfMonthly: 0,
        appliedCoefficients: {
          baseRentPerSqm: 0,
          locationCoef: 0,
          ageCoef: 0,
          energyCoef: 0,
          chargesRateOptimistic: 0,
          chargesRatePessimistic: 0,
          heatingAdj: 0,
          serviceAdj: 0,
        },
        inputsUsed: {
          livingAreaSqm: 0,
          segment: "UNKNOWN",
          effectiveYear: null,
          energyLabel: null,
          heatingType: null,
          hasElevator: false,
          hasConcierge: false,
        },
        warnings: ["SKIPPED: livingAreaSqm is required for estimation"],
      });
      continue;
    }

    const inputs: EstimationInputs = {
      unitId: unit.id,
      livingAreaSqm: unit.livingAreaSqm,
      locationSegment: unit.locationSegment,
      yearBuilt: unit.building?.yearBuilt,
      lastRenovationYear: unit.lastRenovationYear,
      energyLabel: unit.energyLabel,
      heatingType: unit.heatingType,
      hasElevator: unit.building?.hasElevator ?? false,
      hasConcierge: unit.building?.hasConcierge ?? false,
    };

    results.push(computeRentEstimate(inputs, config));
  }

  return results;
}
