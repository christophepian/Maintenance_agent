/**
 * Asset Inventory Service
 *
 * Orchestrates asset lookups and depreciation computation.
 * Uses assetRepo for all Prisma queries (G10 — no Prisma in services).
 *
 * Depreciation formula:
 *   clockStart = replacedAt ?? installedAt
 *   ageMonths = diff(now, clockStart)
 *   depreciationPct = min(100, (ageMonths / usefulLifeMonths) * 100)
 *   residualPct = 100 - depreciationPct
 */

import { PrismaClient, AssetType } from "@prisma/client";
import { assetRepo } from "../repositories";

// ─── Types ─────────────────────────────────────────────────────

export interface DepreciationInfo {
  usefulLifeMonths: number;
  ageMonths: number;
  depreciationPct: number;
  residualPct: number;
  clockStart: string | null;
  standardId: string | null;
}

export interface AssetInventoryItem {
  id: string;
  orgId: string;
  unitId: string;
  type: AssetType;
  topic: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  notes?: string;
  assetModelId?: string;
  installedAt?: string;
  lastRenovatedAt?: string;
  replacedAt?: string;
  isPresent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  depreciation: DepreciationInfo | null;
  interventions: InterventionDTO[];
  unit?: { id: string; unitNumber: string };
}

export interface InterventionDTO {
  id: string;
  type: string;
  interventionDate: string;
  costChf?: number;
  jobId?: string;
  jobStatus?: string;
  notes?: string;
  createdAt: string;
}

// ─── Depreciation Computation ──────────────────────────────────

function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
}

export function computeDepreciation(
  asset: { installedAt: Date | null; replacedAt: Date | null },
  standard: { usefulLifeMonths: number; id: string } | null,
): DepreciationInfo | null {
  if (!standard) return null;

  const clockStart = asset.replacedAt ?? asset.installedAt;
  if (!clockStart) return null;

  const now = new Date();
  const ageMonths = Math.max(0, monthsBetween(clockStart, now));
  const depreciationPct = Math.min(100, Math.round((ageMonths / standard.usefulLifeMonths) * 100));
  const residualPct = 100 - depreciationPct;

  return {
    usefulLifeMonths: standard.usefulLifeMonths,
    ageMonths,
    depreciationPct,
    residualPct,
    clockStart: clockStart.toISOString(),
    standardId: standard.id,
  };
}

// ─── Depreciation Standard Lookup ──────────────────────────────

async function findDepreciationStandard(
  prisma: PrismaClient,
  assetType: AssetType,
  topic: string,
  canton?: string | null,
): Promise<{ usefulLifeMonths: number; id: string } | null> {
  // First try exact canton match
  if (canton) {
    const standard = await prisma.depreciationStandard.findFirst({
      where: { assetType, topic, canton, jurisdiction: "CH" },
      select: { id: true, usefulLifeMonths: true },
    });
    if (standard) return standard;
  }

  // Fall back to national (canton = null)
  const standard = await prisma.depreciationStandard.findFirst({
    where: { assetType, topic, canton: null, jurisdiction: "CH" },
    select: { id: true, usefulLifeMonths: true },
  });

  return standard;
}

// ─── DTO Mapping ───────────────────────────────────────────────

function mapIntervention(i: any): InterventionDTO {
  return {
    id: i.id,
    type: i.type,
    interventionDate: i.interventionDate.toISOString(),
    ...(i.costChf != null ? { costChf: i.costChf } : {}),
    ...(i.jobId ? { jobId: i.jobId } : {}),
    ...(i.job?.status ? { jobStatus: i.job.status } : {}),
    ...(i.notes ? { notes: i.notes } : {}),
    createdAt: i.createdAt.toISOString(),
  };
}

function mapAssetToDTO(
  asset: any,
  depreciation: DepreciationInfo | null,
): AssetInventoryItem {
  return {
    id: asset.id,
    orgId: asset.orgId,
    unitId: asset.unitId,
    type: asset.type,
    topic: asset.topic,
    name: asset.name,
    ...(asset.brand ? { brand: asset.brand } : {}),
    ...(asset.modelNumber ? { modelNumber: asset.modelNumber } : {}),
    ...(asset.serialNumber ? { serialNumber: asset.serialNumber } : {}),
    ...(asset.notes ? { notes: asset.notes } : {}),
    ...(asset.assetModelId ? { assetModelId: asset.assetModelId } : {}),
    ...(asset.installedAt ? { installedAt: asset.installedAt.toISOString() } : {}),
    ...(asset.lastRenovatedAt ? { lastRenovatedAt: asset.lastRenovatedAt.toISOString() } : {}),
    ...(asset.replacedAt ? { replacedAt: asset.replacedAt.toISOString() } : {}),
    isPresent: asset.isPresent,
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    depreciation,
    interventions: (asset.interventions ?? []).map(mapIntervention),
    ...(asset.unit ? { unit: { id: asset.unit.id, unitNumber: asset.unit.unitNumber } } : {}),
  };
}

// ─── Public Service Functions ──────────────────────────────────

/**
 * Get full asset inventory for a unit with depreciation info.
 */
export async function getAssetInventoryForUnit(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  canton?: string | null,
): Promise<AssetInventoryItem[]> {
  const assets = await assetRepo.findAssetsByUnit(prisma, orgId, unitId);

  const result: AssetInventoryItem[] = [];
  for (const asset of assets) {
    const standard = await findDepreciationStandard(prisma, asset.type, asset.topic, canton);
    const depreciation = computeDepreciation(asset, standard);
    result.push(mapAssetToDTO(asset, depreciation));
  }

  return result;
}

// ─── Repair vs Replace Analysis ────────────────────────────────

export type RepairReplaceRecommendation = "REPAIR" | "MONITOR" | "REPLACE";

export interface RepairReplaceItem {
  assetId: string;
  assetName: string;
  assetType: string;
  topic: string;
  installedAt: string | null;
  ageMonths: number | null;
  usefulLifeMonths: number | null;
  depreciationPct: number | null;
  residualPct: number | null;
  cumulativeRepairCostChf: number;
  recommendation: RepairReplaceRecommendation;
}

/**
 * Compute per-asset repair-vs-replace recommendations for a unit.
 * Recommendation logic:
 *   REPLACE  — depreciationPct >= 100 (end of useful life)
 *   MONITOR  — depreciationPct >= 75  (within last 25% of useful life)
 *   REPAIR   — otherwise
 */
export async function getRepairReplaceAnalysis(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  canton?: string | null,
): Promise<RepairReplaceItem[]> {
  const assets = await getAssetInventoryForUnit(prisma, orgId, unitId, canton);

  return assets.map((asset) => {
    // Sum intervention costs for non-replacement interventions
    const cumulativeRepairCostChf = asset.interventions
      .filter((i) => i.type !== "REPLACEMENT")
      .reduce((sum, i) => sum + (i.costChf ?? 0), 0);

    const dep = asset.depreciation;

    let recommendation: RepairReplaceRecommendation = "REPAIR";
    if (dep !== null) {
      if (dep.depreciationPct >= 100) recommendation = "REPLACE";
      else if (dep.depreciationPct >= 75) recommendation = "MONITOR";
    }

    return {
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type,
      topic: asset.topic,
      installedAt: asset.installedAt ?? null,
      ageMonths: dep?.ageMonths ?? null,
      usefulLifeMonths: dep?.usefulLifeMonths ?? null,
      depreciationPct: dep?.depreciationPct ?? null,
      residualPct: dep?.residualPct ?? null,
      cumulativeRepairCostChf,
      recommendation,
    };
  });
}

/**
 * Get full asset inventory for a building with depreciation info.
 * Returns all assets across all units, enriched with unit info.
 */
export async function getAssetInventoryForBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  options: { buildingLevelOnly?: boolean; canton?: string | null } = {},
): Promise<AssetInventoryItem[]> {
  const { buildingLevelOnly = false, canton } = options;
  const assets = await assetRepo.findAssetsByBuilding(prisma, orgId, buildingId, {
    buildingLevelOnly,
  });

  const result: AssetInventoryItem[] = [];
  for (const asset of assets) {
    const standard = await findDepreciationStandard(prisma, asset.type, asset.topic, canton);
    const depreciation = computeDepreciation(asset, standard);
    result.push(mapAssetToDTO(asset, depreciation));
  }

  return result;
}
