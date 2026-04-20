/**
 * Asset Inventory Service
 *
 * Orchestrates asset lookups and depreciation computation.
 * Uses assetRepo for all Prisma queries (G10 — no Prisma in services).
 *
 * ─── Domain Model ────────────────────────────────────────────
 *
 *   Asset          = umbrella instance (physical thing in a unit/building)
 *   assetCategory  = EQUIPMENT | COMPONENT (business grouping)
 *   assetType      = operational classification (part of depreciation compound key)
 *   topic          = PRIMARY depreciation key (most specific depreciable item)
 *   AssetModel     = reusable catalog entry — mainly for EQUIPMENT (model-identifiable)
 *
 * Depreciation formula:
 *   clockStart = replacedAt ?? installedAt
 *   ageMonths = diff(now, clockStart)
 *   depreciationPct = min(100, (ageMonths / usefulLifeMonths) * 100)
 *   residualPct = 100 - depreciationPct
 *
 * Useful life resolution priority (topic-first):
 *   1. Asset-specific override     (Asset.usefulLifeOverrideMonths)
 *   2. AssetModel default life     (AssetModel.defaultUsefulLifeMonths)
 *   3. DepreciationStandard by topic + canton
 *   4. DepreciationStandard by topic, national
 *   5. null → no depreciation
 */

import { PrismaClient, AssetType, AssetCategory } from "@prisma/client";
import { assetRepo } from "../repositories";
import { ASSET_TYPE_TO_CATEGORY } from "../repositories/assetRepository";
import { estimateReplacementCost, ReplacementCostEstimate } from "./replacementCostService";
import { normalizeTopicKey } from "../utils/topicKey";

// ─── Types ─────────────────────────────────────────────────────

export interface DepreciationInfo {
  usefulLifeMonths: number;
  ageMonths: number;
  depreciationPct: number;
  residualPct: number;
  clockStart: string | null;
  standardId: string | null;
  /** Which resolution tier produced the useful life value. */
  depreciationSource: DepreciationSource | null;
}

export interface AssetInventoryItem {
  id: string;
  orgId: string;
  unitId: string;
  type: AssetType;
  category: AssetCategory;
  topic: string;
  /** Canonical normalized form of topic, used for depreciation matching. */
  topicKey: string;
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
  resolved: ResolvedUsefulLife | { usefulLifeMonths: number; id: string } | null,
): DepreciationInfo | null {
  if (!resolved) return null;

  const clockStart = asset.replacedAt ?? asset.installedAt;
  if (!clockStart) return null;

  const now = new Date();
  const ageMonths = Math.max(0, monthsBetween(clockStart, now));
  const usefulLifeMonths = resolved.usefulLifeMonths;
  const depreciationPct = Math.min(100, Math.round((ageMonths / usefulLifeMonths) * 100));
  const residualPct = 100 - depreciationPct;

  // Support both ResolvedUsefulLife (new) and legacy {id} shape
  const source = "source" in resolved ? resolved.source : null;
  const standardId = "standardId" in resolved ? resolved.standardId : ("id" in resolved ? (resolved as any).id : null);

  return {
    usefulLifeMonths,
    ageMonths,
    depreciationPct,
    residualPct,
    clockStart: clockStart.toISOString(),
    standardId,
    depreciationSource: source,
  };
}

// ─── Depreciation Resolution ───────────────────────────────────
//
// Resolution priority (topic-first):
//   1. Asset-specific override     (Asset.usefulLifeOverrideMonths)
//   2. AssetModel default life     (AssetModel.defaultUsefulLifeMonths)
//   3. DepreciationStandard by topic + canton (exact match)
//   4. DepreciationStandard by topic, national (canton = null)
//   5. null → no depreciation computed

/** Identifies which resolution tier produced the useful life value. */
export type DepreciationSource =
  | "ASSET_OVERRIDE"      // per-asset usefulLifeOverrideMonths
  | "ASSET_MODEL"         // AssetModel.defaultUsefulLifeMonths
  | "STANDARD_CANTON"     // DepreciationStandard matched by topic + canton
  | "STANDARD_NATIONAL";  // DepreciationStandard matched by topic, national

export interface ResolvedUsefulLife {
  usefulLifeMonths: number;
  standardId: string | null;
  source: DepreciationSource;
}

/**
 * Resolve the useful life for an asset using the topic-first priority chain.
 *
 * topic is the PRIMARY depreciation key.
 * assetType is used only as part of the DepreciationStandard compound key
 * (the standard table is keyed by assetType+topic), NOT as a standalone fallback.
 */
async function resolveUsefulLife(
  prisma: PrismaClient,
  assetType: AssetType,
  topic: string,
  canton?: string | null,
  overrideMonths?: number | null,
  assetModelDefaultMonths?: number | null,
): Promise<ResolvedUsefulLife | null> {
  // Tier 1: per-asset override (Asset.usefulLifeOverrideMonths)
  if (overrideMonths != null) {
    return { usefulLifeMonths: overrideMonths, standardId: null, source: "ASSET_OVERRIDE" };
  }

  // Tier 2: asset model default (AssetModel.defaultUsefulLifeMonths)
  if (assetModelDefaultMonths != null) {
    return { usefulLifeMonths: assetModelDefaultMonths, standardId: null, source: "ASSET_MODEL" };
  }

  // normalizeTopicKey → UPPER_SNAKE_CASE, but the DB may have mixed-case rows
  // from older seeds ("Kitchen", "dishwasher", etc.).
  // All topic queries use mode:"insensitive" so they match regardless of stored case.
  const topicKey = normalizeTopicKey(topic);

  // Tier 3: DepreciationStandard by topic + canton (case-insensitive)
  if (canton) {
    const standard = await prisma.depreciationStandard.findFirst({
      where: { assetType, topic: { equals: topicKey, mode: "insensitive" }, canton, jurisdiction: "CH" },
      select: { id: true, usefulLifeMonths: true },
    });
    if (standard) return { ...standard, standardId: standard.id, source: "STANDARD_CANTON" };
  }

  // Tier 4: DepreciationStandard by topic + assetType, national (case-insensitive)
  const standard = await prisma.depreciationStandard.findFirst({
    where: { assetType, topic: { equals: topicKey, mode: "insensitive" }, canton: null, jurisdiction: "CH" },
    select: { id: true, usefulLifeMonths: true },
  });
  if (standard) return { ...standard, standardId: standard.id, source: "STANDARD_NATIONAL" };

  // Tier 5: topic-only fallback — drop assetType constraint (case-insensitive).
  // Handles assets whose stored assetType doesn't match the standard's type.
  const fallback = await prisma.depreciationStandard.findFirst({
    where: { topic: { equals: topicKey, mode: "insensitive" }, canton: null, jurisdiction: "CH" },
    select: { id: true, usefulLifeMonths: true },
    orderBy: { assetType: "asc" },
  });
  if (fallback) return { usefulLifeMonths: fallback.usefulLifeMonths, standardId: fallback.id, source: "STANDARD_NATIONAL" };

  return null;
}

/** Backward-compatible wrapper — existing callers that only need {usefulLifeMonths, id}. */
async function findDepreciationStandard(
  prisma: PrismaClient,
  assetType: AssetType,
  topic: string,
  canton?: string | null,
): Promise<{ usefulLifeMonths: number; id: string } | null> {
  const resolved = await resolveUsefulLife(prisma, assetType, topic, canton);
  if (!resolved) return null;
  return { usefulLifeMonths: resolved.usefulLifeMonths, id: resolved.standardId ?? "" };
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
    category: asset.category ?? ASSET_TYPE_TO_CATEGORY[asset.type as AssetType] ?? "EQUIPMENT",
    topic: asset.topic,
    topicKey: normalizeTopicKey(asset.topic),
    name: asset.name,
    ...(asset.brand ? { brand: asset.brand } : {}),
    ...(asset.modelNumber ? { modelNumber: asset.modelNumber } : {}),
    ...(asset.serialNumber ? { serialNumber: asset.serialNumber } : {}),
    ...(asset.notes ? { notes: asset.notes } : {}),
    ...(asset.assetModelId ? { assetModelId: asset.assetModelId } : {}),
    ...(asset.usefulLifeOverrideMonths != null ? { usefulLifeOverrideMonths: asset.usefulLifeOverrideMonths } : {}),
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
    const resolved = await resolveUsefulLife(
      prisma, asset.type, asset.topic, canton,
      asset.usefulLifeOverrideMonths,
      asset.assetModel?.defaultUsefulLifeMonths,
    );
    const depreciation = computeDepreciation(asset, resolved);
    result.push(mapAssetToDTO(asset, depreciation));
  }

  return result;
}

// ─── Repair vs Replace Analysis ────────────────────────────────

export type RepairReplaceRecommendation = "REPAIR" | "MONITOR" | "PLAN_REPLACEMENT" | "REPLACE";

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
  remainingLifeMonths: number | null;
  cumulativeRepairCostChf: number;
  estimatedReplacementCostChf: number | null;
  replacementCostConfidence: number | null;
  repairToReplacementRatio: number | null;
  annualRepairRate: number | null;
  breakEvenMonths: number | null;
  warrantyOffsetMonths: number;
  recommendation: RepairReplaceRecommendation;
  recommendationReason: string;
}

/** Default assumed warranty period for a brand-new replacement (months) */
const DEFAULT_WARRANTY_MONTHS = 24;

/**
 * Compute per-asset repair-vs-replace recommendations for a unit.
 *
 * Enhanced recommendation engine:
 *   1. Depreciation position (how much life is left)
 *   2. Repair-to-replacement ratio (cumulative repair cost vs replacement cost)
 *   3. Break-even analysis (when does continuing to repair exceed replacement?)
 *   4. Warranty offset (new unit comes with warranty coverage)
 *
 * Recommendation tiers:
 *   REPLACE          — end of life OR cumulative repairs ≥ 60% of replacement cost
 *   PLAN_REPLACEMENT — depreciation ≥ 85% OR repairs ≥ 40% of replacement cost
 *   MONITOR          — depreciation ≥ 65% OR repairs ≥ 25% of replacement cost
 *   REPAIR           — otherwise
 */
export async function getRepairReplaceAnalysis(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  canton?: string | null,
): Promise<RepairReplaceItem[]> {
  const assets = await getAssetInventoryForUnit(prisma, orgId, unitId, canton);

  const results: RepairReplaceItem[] = [];

  for (const asset of assets) {
    // Sum intervention costs for non-replacement interventions
    const cumulativeRepairCostChf = asset.interventions
      .filter((i) => i.type !== "REPLACEMENT")
      .reduce((sum, i) => sum + (i.costChf ?? 0), 0);

    const dep = asset.depreciation;

    // Get replacement cost estimate
    let replacementEstimate: ReplacementCostEstimate | null = null;
    try {
      replacementEstimate = await estimateReplacementCost(
        prisma, orgId, asset.type, asset.topic,
      );
      // If confidence is 0 (no data at all), treat as null
      if (replacementEstimate.confidence === 0) replacementEstimate = null;
    } catch {
      // Non-fatal — continue without cost estimate
    }

    const estimatedReplacementCostChf = replacementEstimate?.bestEstimate.medianChf ?? null;
    const replacementCostConfidence = replacementEstimate?.confidence ?? null;

    // Repair-to-replacement ratio
    const repairToReplacementRatio =
      estimatedReplacementCostChf != null && estimatedReplacementCostChf > 0
        ? Math.round((cumulativeRepairCostChf / estimatedReplacementCostChf) * 100) / 100
        : null;

    // Remaining useful life
    const remainingLifeMonths =
      dep != null
        ? Math.max(0, dep.usefulLifeMonths - dep.ageMonths)
        : null;

    // Annual repair rate (CHF/year) — based on asset age
    const ageYears = dep != null && dep.ageMonths > 0 ? dep.ageMonths / 12 : null;
    const annualRepairRate =
      ageYears != null && ageYears > 0
        ? Math.round(cumulativeRepairCostChf / ageYears)
        : null;

    // Break-even analysis: at the current annual repair rate, how many months
    // until total repairs exceed replacement cost?
    let breakEvenMonths: number | null = null;
    if (annualRepairRate != null && annualRepairRate > 0 && estimatedReplacementCostChf != null) {
      const remainingBudget = estimatedReplacementCostChf - cumulativeRepairCostChf;
      if (remainingBudget <= 0) {
        breakEvenMonths = 0; // already exceeded
      } else {
        breakEvenMonths = Math.round((remainingBudget / annualRepairRate) * 12);
      }
    }

    // Recommendation engine
    let recommendation: RepairReplaceRecommendation = "REPAIR";
    let recommendationReason = "Asset is in good condition relative to its useful life.";

    const depPct = dep?.depreciationPct ?? 0;

    // Tier 1: REPLACE
    if (depPct >= 100) {
      recommendation = "REPLACE";
      recommendationReason = "Asset has reached end of useful life.";
    } else if (repairToReplacementRatio != null && repairToReplacementRatio >= 0.6) {
      recommendation = "REPLACE";
      recommendationReason = `Cumulative repairs (${Math.round(repairToReplacementRatio * 100)}%) have reached 60% of replacement cost.`;
    } else if (breakEvenMonths != null && breakEvenMonths === 0) {
      recommendation = "REPLACE";
      recommendationReason = "Cumulative repair cost already exceeds estimated replacement cost.";
    }
    // Tier 2: PLAN_REPLACEMENT
    else if (depPct >= 85) {
      recommendation = "PLAN_REPLACEMENT";
      recommendationReason = `Asset is ${depPct}% depreciated — nearing end of life.`;
    } else if (repairToReplacementRatio != null && repairToReplacementRatio >= 0.4) {
      recommendation = "PLAN_REPLACEMENT";
      recommendationReason = `Cumulative repairs (${Math.round(repairToReplacementRatio * 100)}%) approaching replacement cost threshold.`;
    }
    // Tier 3: MONITOR
    else if (depPct >= 65) {
      recommendation = "MONITOR";
      recommendationReason = `Asset is ${depPct}% depreciated — monitor for increasing repair frequency.`;
    } else if (repairToReplacementRatio != null && repairToReplacementRatio >= 0.25) {
      recommendation = "MONITOR";
      recommendationReason = `Repair costs (${Math.round(repairToReplacementRatio * 100)}% of replacement) are accumulating.`;
    }
    // Tier 4: REPAIR (default) — already set

    results.push({
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type,
      topic: asset.topic,
      installedAt: asset.installedAt ?? null,
      ageMonths: dep?.ageMonths ?? null,
      usefulLifeMonths: dep?.usefulLifeMonths ?? null,
      depreciationPct: dep?.depreciationPct ?? null,
      residualPct: dep?.residualPct ?? null,
      remainingLifeMonths,
      cumulativeRepairCostChf,
      estimatedReplacementCostChf,
      replacementCostConfidence,
      repairToReplacementRatio,
      annualRepairRate,
      breakEvenMonths,
      warrantyOffsetMonths: DEFAULT_WARRANTY_MONTHS,
      recommendation,
      recommendationReason,
    });
  }

  return results;
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
    const resolved = await resolveUsefulLife(
      prisma, asset.type, asset.topic, canton,
      asset.usefulLifeOverrideMonths,
      asset.assetModel?.defaultUsefulLifeMonths,
    );
    const depreciation = computeDepreciation(asset, resolved);
    result.push(mapAssetToDTO(asset, depreciation));
  }

  return result;
}
