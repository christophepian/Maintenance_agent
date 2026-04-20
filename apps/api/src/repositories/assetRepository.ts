/**
 * Asset Repository
 *
 * Centralizes all Prisma access for Asset and AssetIntervention entities.
 * Owns canonical include trees so that DTO mappers always receive
 * the correct shape.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 *
 * ─── Domain Model ───────────────────────────────────────────────
 *
 *   Asset          = umbrella instance (the physical thing in the building)
 *   assetCategory  = EQUIPMENT | COMPONENT (business grouping)
 *   assetType      = operational classification — fallback for depreciation
 *   topic          = PRIMARY depreciation key (e.g. DISHWASHER, PARQUET_MOSAIC)
 *   AssetModel     = reusable catalog entry for model-identifiable assets,
 *                    primarily equipment (appliances, fixtures). Structural
 *                    elements like walls/floors/ceilings are NOT model-driven.
 *   DepreciationStandard = useful life rule, resolved PRIMARILY by topic.
 *
 * ─── Depreciation Resolution Priority ──────────────────────────
 *
 *   1. Asset-specific override (future: Asset.usefulLifeOverrideMonths)
 *   2. AssetModel default useful life (future: AssetModel.defaultUsefulLifeMonths)
 *   3. DepreciationStandard matched by exact topic + canton
 *   4. DepreciationStandard matched by exact topic (national)
 *   5. Fallback: no standard found → null (no depreciation computed)
 *
 *   Tiers 1 & 2 are NOT yet in schema — they are documented here as the
 *   intended extension path. Today only tiers 3–4 are active.
 */

import { PrismaClient, AssetType, AssetCategory, AssetInterventionType } from "@prisma/client";

// ─── AssetType → AssetCategory deterministic mapping ───────────
//
// assetCategory = business grouping (EQUIPMENT vs COMPONENT)
// assetType     = operational classification (UI, filters, legacy logic)
// topic         = PRIMARY depreciation key (e.g. DISHWASHER, PARQUET_MOSAIC)
//
export const ASSET_TYPE_TO_CATEGORY: Record<AssetType, AssetCategory> = {
  APPLIANCE: "EQUIPMENT",
  FIXTURE: "EQUIPMENT",
  FINISH: "COMPONENT",
  STRUCTURAL: "COMPONENT",
  SYSTEM: "COMPONENT",
  OTHER: "EQUIPMENT",
};

export function deriveCategory(type: AssetType): AssetCategory {
  return ASSET_TYPE_TO_CATEGORY[type];
}

/**
 * Whether an asset type/category is eligible for AssetModel assignment.
 *
 * Asset models represent reusable catalog entries (manufacturer + model number)
 * and are meaningful only for equipment-like assets: appliances, fixtures, etc.
 * Structural elements (walls, ceilings, floors) and building systems (HVAC, plumbing)
 * are typically not model-identifiable and should not be linked to AssetModel.
 */
export function isModelEligible(type: AssetType): boolean {
  return deriveCategory(type) === "EQUIPMENT";
}

// ─── Canonical Includes ────────────────────────────────────────

export const ASSET_FULL_INCLUDE = {
  interventions: {
    orderBy: { interventionDate: "desc" as const },
    include: {
      job: { select: { id: true, status: true } },
    },
  },
  assetModel: {
    select: { id: true, defaultUsefulLifeMonths: true },
  },
} as const;

/** Lighter include for asset list views (no interventions). */
export const ASSET_LIST_INCLUDE = {
  unit: { select: { id: true, unitNumber: true, buildingId: true } },
} as const;

// ─── Type-level inference: building vs unit ────────────────────

/** STRUCTURAL and SYSTEM assets are building-level; rest are unit-level */
const BUILDING_LEVEL_TYPES: AssetType[] = ["STRUCTURAL", "SYSTEM"];

export function isBuildingLevelType(type: AssetType): boolean {
  return BUILDING_LEVEL_TYPES.includes(type);
}

// ─── Query Functions ───────────────────────────────────────────

/**
 * Fetch all assets for a given unit (with interventions).
 */
export async function findAssetsByUnit(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  includeInactive = false,
) {
  return prisma.asset.findMany({
    where: {
      orgId,
      unitId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: ASSET_FULL_INCLUDE,
    orderBy: [{ type: "asc" }, { topic: "asc" }, { name: "asc" }],
  });
}

/**
 * Fetch all assets for a building (across all its units) with interventions.
 * Building-level assets are STRUCTURAL and SYSTEM types.
 * If buildingLevelOnly is true, returns only STRUCTURAL/SYSTEM assets.
 */
export async function findAssetsByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  options: { includeInactive?: boolean; buildingLevelOnly?: boolean } = {},
) {
  const { includeInactive = false, buildingLevelOnly = false } = options;

  // Get all unit IDs in the building
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);

  return prisma.asset.findMany({
    where: {
      orgId,
      unitId: { in: unitIds },
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildingLevelOnly ? { type: { in: BUILDING_LEVEL_TYPES } } : {}),
    },
    include: {
      ...ASSET_FULL_INCLUDE,
      unit: { select: { id: true, unitNumber: true } },
    },
    orderBy: [{ type: "asc" }, { topic: "asc" }, { name: "asc" }],
  });
}

/**
 * Fetch a single asset by ID with full includes.
 */
export async function findAssetById(
  prisma: PrismaClient,
  orgId: string,
  assetId: string,
) {
  return prisma.asset.findFirst({
    where: { id: assetId, orgId },
    include: ASSET_FULL_INCLUDE,
  });
}

/**
 * Create or update an asset (upsert by orgId + unitId + type + topic + name).
 */
export async function upsertAsset(
  prisma: PrismaClient,
  orgId: string,
  data: {
    unitId: string;
    type: AssetType;
    topic: string;
    name: string;
    assetModelId?: string | null;
    installedAt?: Date | null;
    lastRenovatedAt?: Date | null;
    replacedAt?: Date | null;
    brand?: string | null;
    modelNumber?: string | null;
    serialNumber?: string | null;
    usefulLifeOverrideMonths?: number | null;
    notes?: string | null;
    isPresent?: boolean;
  },
) {
  // Try to find existing asset with same type+topic+name in unit
  const existing = await prisma.asset.findFirst({
    where: {
      orgId,
      unitId: data.unitId,
      type: data.type,
      topic: data.topic,
      name: data.name,
    },
  });

  // Safety net: strip assetModelId for non-model-eligible types.
  // Generic components (walls, floors, ceilings, HVAC systems) are not model-driven.
  const effectiveModelId = isModelEligible(data.type) ? (data.assetModelId ?? null) : null;

  const payload = {
    type: data.type,
    category: deriveCategory(data.type),
    topic: data.topic,
    name: data.name,
    assetModelId: effectiveModelId,
    installedAt: data.installedAt ?? null,
    lastRenovatedAt: data.lastRenovatedAt ?? null,
    replacedAt: data.replacedAt ?? null,
    brand: data.brand ?? null,
    modelNumber: data.modelNumber ?? null,
    serialNumber: data.serialNumber ?? null,
    usefulLifeOverrideMonths: data.usefulLifeOverrideMonths ?? null,
    notes: data.notes ?? null,
    isPresent: data.isPresent ?? true,
    isActive: true,
  };

  if (existing) {
    return prisma.asset.update({
      where: { id: existing.id },
      data: payload,
      include: ASSET_FULL_INCLUDE,
    });
  }

  return prisma.asset.create({
    data: {
      orgId,
      unitId: data.unitId,
      ...payload,
    },
    include: ASSET_FULL_INCLUDE,
  });
}

/**
 * Add an intervention to an asset.
 */
export async function addIntervention(
  prisma: PrismaClient,
  assetId: string,
  data: {
    type: AssetInterventionType;
    interventionDate: Date;
    costChf?: number | null;
    jobId?: string | null;
    notes?: string | null;
  },
) {
  const intervention = await prisma.assetIntervention.create({
    data: {
      assetId,
      type: data.type,
      interventionDate: data.interventionDate,
      costChf: data.costChf ?? null,
      jobId: data.jobId ?? null,
      notes: data.notes ?? null,
    },
    include: {
      job: { select: { id: true, status: true } },
    },
  });

  // If intervention is a REPLACEMENT, update the asset's replacedAt field
  if (data.type === "REPLACEMENT") {
    await prisma.asset.update({
      where: { id: assetId },
      data: { replacedAt: data.interventionDate },
    });
  }

  return intervention;
}

/**
 * Partial update of mutable asset fields.
 * topic and type are NOT updatable — they must remain stable for depreciation matching.
 */
export async function updateAsset(
  prisma: PrismaClient,
  orgId: string,
  assetId: string,
  data: {
    name?: string;
    installedAt?: Date | null;
    lastRenovatedAt?: Date | null;
    replacedAt?: Date | null;
    brand?: string | null;
    modelNumber?: string | null;
    serialNumber?: string | null;
    usefulLifeOverrideMonths?: number | null;
    notes?: string | null;
    isPresent?: boolean;
  },
) {
  const existing = await prisma.asset.findFirst({ where: { id: assetId, orgId } });
  if (!existing) return null;

  return prisma.asset.update({
    where: { id: assetId },
    data,
    include: ASSET_FULL_INCLUDE,
  });
}

/**
 * Soft-delete an asset (set isActive = false).
 */
export async function deactivateAsset(
  prisma: PrismaClient,
  orgId: string,
  assetId: string,
) {
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, orgId },
  });
  if (!existing) return null;

  return prisma.asset.update({
    where: { id: assetId },
    data: { isActive: false },
    include: ASSET_FULL_INCLUDE,
  });
}

/**
 * List assets across all units for an org (with optional unit filter).
 * Used by GET /assets route. CQ-12 fix.
 */
export async function findAssetsForOrg(
  prisma: PrismaClient,
  orgId: string,
  opts: { unitId?: string; limit?: number; offset?: number },
) {
  const where: any = { orgId, isActive: true };
  if (opts.unitId) where.unitId = opts.unitId;

  const [rows, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: ASSET_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    }),
    prisma.asset.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Create a new asset (simple creation without upsert logic).
 * Used by POST /assets route. CQ-12 fix.
 *
 * Aligned with the canonical upsert path: enforces category derivation,
 * model eligibility, and expects pre-validated/normalized input
 * (callers must run through CreateAssetSchema or UpsertAssetSchema first).
 */
export async function createAssetSimple(
  prisma: PrismaClient,
  orgId: string,
  data: {
    unitId: string;
    type: AssetType;
    topic: string;
    name: string;
    assetModelId?: string | null;
    installedAt?: Date | null;
    lastRenovatedAt?: Date | null;
    replacedAt?: Date | null;
    brand?: string | null;
    modelNumber?: string | null;
    serialNumber?: string | null;
    usefulLifeOverrideMonths?: number | null;
    notes?: string | null;
    isPresent?: boolean;
  },
) {
  const effectiveModelId = isModelEligible(data.type) ? (data.assetModelId ?? null) : null;

  return prisma.asset.create({
    data: {
      orgId,
      unitId: data.unitId,
      type: data.type,
      category: deriveCategory(data.type),
      topic: data.topic,
      name: data.name,
      assetModelId: effectiveModelId,
      installedAt: data.installedAt ?? null,
      lastRenovatedAt: data.lastRenovatedAt ?? null,
      replacedAt: data.replacedAt ?? null,
      brand: data.brand ?? null,
      modelNumber: data.modelNumber ?? null,
      serialNumber: data.serialNumber ?? null,
      usefulLifeOverrideMonths: data.usefulLifeOverrideMonths ?? null,
      notes: data.notes ?? null,
      isPresent: data.isPresent ?? true,
      isActive: true,
    },
    include: ASSET_FULL_INCLUDE,
  });
}
