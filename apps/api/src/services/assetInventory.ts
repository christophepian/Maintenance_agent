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
import { findLatestConditionsForAssets, LatestCondition } from "../repositories/conditionReportRepository";

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
  unitId: string | null;
  buildingId?: string | null;
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
  latestCondition?: LatestCondition | null;
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
  // Guard against a non-positive useful life (bad override/model data): dividing
  // by 0 yields NaN/Infinity which would poison depreciationPct → residualPct and
  // flow silently into the capex schedule and NPV. No usable life = no computable
  // depreciation, so return null (treated as "no depreciation data" downstream).
  if (!(usefulLifeMonths > 0)) return null;
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

// ─── Static Depreciation Standards (Swiss HEV 2024) ───────────
// Fallback useful-life values used when the DepreciationStandard table has no
// matching row (e.g. fresh DB without seed). Mirrors the values in seed.ts.
// Keys are UPPER_SNAKE_CASE topic values.

type UsefulLifeKey = string; // `${AssetType}::${topic}`
const STATIC_USEFUL_LIFE_MONTHS: Record<UsefulLifeKey, number> = {
  "SYSTEM::ELEVATOR":                      300, // 25 yr
  "SYSTEM::ELEVATOR_ELECTRICS":            240, // 20 yr
  "SYSTEM::CENTRAL_HEATING":               300, // 25 yr
  "SYSTEM::BOILER":                        240, // 20 yr
  "SYSTEM::CIRCULATION_PUMP":              180, // 15 yr
  "SYSTEM::HEATING_CONTROL":               180, // 15 yr
  "SYSTEM::WATER_PIPES":                   360, // 30 yr
  "SYSTEM::PIPE_COLD_COPPER":              360, // 30 yr
  "SYSTEM::PIPE_HOT_COPPER_INSULATED":     360, // 30 yr
  "SYSTEM::ELECTRICAL_INSTALLATION":       300, // 25 yr
  "SYSTEM::ELECTRICAL_CABLES":             360, // 30 yr
  "SYSTEM::INTERCOM":                      180, // 15 yr
  "SYSTEM::POWER_SOCKET":                  240, // 20 yr
  "SYSTEM::SWITCH":                        240, // 20 yr
  "STRUCTURAL::STAIRCASE":                 480, // 40 yr
  "STRUCTURAL::ROOF_COVERING":             360, // 30 yr
  "STRUCTURAL::PITCHED_ROOF_TILES":        480, // 40 yr
  "STRUCTURAL::EXTERIOR_WALL_COATING":     240, // 20 yr
  "STRUCTURAL::RENDER_MINERAL":            300, // 25 yr
  "STRUCTURAL::BALCONY_METAL":             300, // 25 yr
  "FIXTURE::ENTRANCE_DOOR":                360, // 30 yr
  "FIXTURE::WINDOW_INSULATED_PLASTIC_WOOD":300, // 25 yr
  "FIXTURE::ROLLER_SHUTTER_PLASTIC":       240, // 20 yr
  "FIXTURE::DOOR_CHIPBOARD":               240, // 20 yr
  "FIXTURE::KITCHEN_CABINET_CHIPBOARD":    240, // 20 yr
  "FIXTURE::COUNTERTOP_SYNTHETIC":         240, // 20 yr
  "FIXTURE::KITCHEN_TAP":                  180, // 15 yr
  "FIXTURE::BATHTUB_ACRYLIC":              240, // 20 yr
  "FIXTURE::SANITARY_CERAMIC":             300, // 25 yr
  "FIXTURE::BATHROOM_TAP":                180, // 15 yr
  "FIXTURE::BALCONY_RAILING_METAL":        300, // 25 yr
  "FIXTURE::COMBINED_LOCK_SYSTEM":         180, // 15 yr
  "FINISH::PAINT_WALLS_DISPERSION":        120, // 10 yr
  "FINISH::PARQUET_MOSAIC":               360, // 30 yr
  "FINISH::KITCHEN_TILES_CERAMIC":         240, // 20 yr
  "FINISH::BATHROOM_TILES_CERAMIC":        240, // 20 yr
  "APPLIANCE::WASHING_MACHINE_COMMON":     144, // 12 yr
  "APPLIANCE::DRYER_COMMON":               144, // 12 yr
  // Common free-text topics not in the HEV controlled-vocabulary list
  "FIXTURE::BATHROOM_INSTALLATION":        300, // 25 yr (equiv. SANITARY_CERAMIC)
  "FIXTURE::KITCHEN_INSTALLATION":         240, // 20 yr (equiv. KITCHEN_CABINET_CHIPBOARD)
  "FIXTURE::INTERIOR_DOORS":               240, // 20 yr (equiv. DOOR_CHIPBOARD)
  "FIXTURE::WINDOWS":                      300, // 25 yr (equiv. WINDOW_INSULATED_PLASTIC_WOOD)
  "FINISH::CEILING_PAINT":                 120, // 10 yr (equiv. PAINT_WALLS_DISPERSION)
  "FINISH::WALL_COATING":                  120, // 10 yr (equiv. PAINT_WALLS_DISPERSION)
  "STRUCTURAL::BALCONY":                   300, // 25 yr (equiv. BALCONY_METAL)
};

// ─── Depreciation Resolution ───────────────────────────────────
//
// Resolution priority (topic-first):
//   1. Asset-specific override     (Asset.usefulLifeOverrideMonths)
//   2. AssetModel default life     (AssetModel.defaultUsefulLifeMonths)
//   3. DepreciationStandard by topic + canton (exact match)
//   4. DepreciationStandard by topic, national (canton = null)
//   5. Static HEV 2024 fallback    (STATIC_USEFUL_LIFE_MONTHS table above)
//   6. null → no depreciation computed

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
  // Tier 1: per-asset override (Asset.usefulLifeOverrideMonths).
  // Only a positive value is usable; a stored 0/negative falls through so the
  // standards/static tiers can supply a real life instead of a divide-by-zero.
  if (overrideMonths != null && overrideMonths > 0) {
    return { usefulLifeMonths: overrideMonths, standardId: null, source: "ASSET_OVERRIDE" };
  }

  // Tier 2: asset model default (AssetModel.defaultUsefulLifeMonths)
  if (assetModelDefaultMonths != null && assetModelDefaultMonths > 0) {
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

  // Tier 6: static HEV 2024 fallback (used when DepreciationStandard table is empty)
  const staticKey = `${assetType}::${topicKey}`;
  const staticMonths = STATIC_USEFUL_LIFE_MONTHS[staticKey];
  if (staticMonths != null) {
    return { usefulLifeMonths: staticMonths, standardId: null, source: "STANDARD_NATIONAL" };
  }

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
  latestCondition?: LatestCondition | null,
): AssetInventoryItem {
  return {
    id: asset.id,
    orgId: asset.orgId,
    unitId: asset.unitId ?? null,
    ...(asset.buildingId ? { buildingId: asset.buildingId } : {}),
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
    latestCondition: latestCondition ?? null,
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

  // Batch-fetch latest condition for all assets in one query
  const assetIds = assets.map((a) => a.id);
  const conditionMap = await findLatestConditionsForAssets(prisma, assetIds, orgId);

  const result: AssetInventoryItem[] = [];
  for (const asset of assets) {
    const resolved = await resolveUsefulLife(
      prisma, asset.type, asset.topic, canton,
      asset.usefulLifeOverrideMonths,
      asset.assetModel?.defaultUsefulLifeMonths,
    );
    const depreciation = computeDepreciation(asset, resolved);
    result.push(mapAssetToDTO(asset, depreciation, conditionMap.get(asset.id) ?? null));
  }

  return result;
}

// ─── Repair vs Replace Analysis ────────────────────────────────

export type RepairReplaceRecommendation = "REPAIR" | "MONITOR" | "PLAN_REPLACEMENT" | "REPLACE";

type LastConditionStatus = "GOOD" | "FAIR" | "POOR" | "DAMAGED" | null;

const REC_TIERS: RepairReplaceRecommendation[] = ["REPAIR", "MONITOR", "PLAN_REPLACEMENT", "REPLACE"];

/**
 * Overlay the last reported physical condition onto a depreciation-derived
 * recommendation. A recent GOOD inspection is evidence an aged asset still
 * functions — so its replacement can be deferred (downgrade one tier). A
 * POOR/DAMAGED inspection warrants earlier intervention (upgrade one tier).
 * FAIR / no report leaves the recommendation unchanged.
 *
 * Pure + exported for unit testing.
 */
export function applyConditionToRecommendation(
  recommendation: RepairReplaceRecommendation,
  reason: string,
  lastCondition: LastConditionStatus,
): { recommendation: RepairReplaceRecommendation; recommendationReason: string } {
  if (lastCondition !== "GOOD" && lastCondition !== "POOR" && lastCondition !== "DAMAGED") {
    return { recommendation, recommendationReason: reason };
  }
  const tier = REC_TIERS.indexOf(recommendation);
  const shifted = lastCondition === "GOOD" ? tier - 1 : tier + 1;
  const next = REC_TIERS[Math.max(0, Math.min(REC_TIERS.length - 1, shifted))];
  if (next === recommendation) {
    return { recommendation, recommendationReason: reason };
  }
  const note =
    lastCondition === "GOOD"
      ? "Last inspection rated GOOD — replacement may be deferred despite age."
      : `Last inspection rated ${lastCondition} — condition warrants earlier intervention.`;
  return { recommendation: next, recommendationReason: `${reason} ${note}` };
}

export interface RepairReplaceItem {
  assetId: string;
  assetName: string;
  applianceName: string | null;
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
  lastConditionStatus: "GOOD" | "FAIR" | "POOR" | "DAMAGED" | null;
  lastConditionAt: string | null;            // ISO date the source report was validated/submitted
  lastConditionReportType: string | null;    // MOVE_IN | MOVE_OUT
  lastConditionValidated: boolean;           // true = from an APPROVED report
  currentLease: {
    tenantName:      string;
    netRentChf:      number;
    endDate:         string | null;
    remainingMonths: number | null;
  } | null;
}

export interface RenovationOpportunity extends RepairReplaceItem {
  unitId:     string;
  unitNumber: string;
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

  // Pre-fetch: active lease for this unit (shared across all assets)
  const today = new Date();
  const activeLease = await prisma.lease.findFirst({
    where: { unitId, orgId, status: { in: ["ACTIVE", "SIGNED"] }, isTemplate: false },
    orderBy: { startDate: "desc" },
    select: { tenantName: true, netRentChf: true, endDate: true },
  });
  const currentLease = activeLease ? {
    tenantName:      activeLease.tenantName,
    netRentChf:      activeLease.netRentChf,
    endDate:         activeLease.endDate?.toISOString().slice(0, 10) ?? null,
    remainingMonths: activeLease.endDate
      ? Math.max(0, Math.round((activeLease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
      : null,
  } : null;

  // Pre-fetch: latest condition report items for this unit (assetId → condition).
  // Capture the report's date/type/validation so the UI can show provenance.
  const latestReport = await prisma.unitConditionReport.findFirst({
    where: { unitId, orgId, status: { in: ["SUBMITTED", "APPROVED"] } },
    orderBy: { submittedAt: "desc" },
    select: {
      status: true, type: true, approvedAt: true, submittedAt: true,
      items: { where: { assetId: { not: null }, condition: { not: "NOT_INSPECTED" } }, select: { assetId: true, condition: true } },
    },
  });
  const conditionMap = new Map<string, "GOOD" | "FAIR" | "POOR" | "DAMAGED">();
  const lastConditionValidated = latestReport?.status === "APPROVED";
  const lastConditionAt = latestReport ? (latestReport.approvedAt ?? latestReport.submittedAt ?? null) : null;
  const lastConditionReportType = latestReport?.type ?? null;
  if (latestReport) {
    for (const item of latestReport.items) {
      if (item.assetId) conditionMap.set(item.assetId, item.condition as "GOOD" | "FAIR" | "POOR" | "DAMAGED");
    }
  }

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

    // Overlay last reported condition: GOOD defers, POOR/DAMAGED accelerates.
    const lastCond = conditionMap.get(asset.id) ?? null;
    ({ recommendation, recommendationReason } = applyConditionToRecommendation(
      recommendation, recommendationReason, lastCond,
    ));

    results.push({
      assetId: asset.id,
      assetName: asset.name,
      applianceName: asset.name,
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
      lastConditionStatus: lastCond,
      lastConditionAt: lastCond && lastConditionAt ? lastConditionAt.toISOString() : null,
      lastConditionReportType: lastCond ? lastConditionReportType : null,
      lastConditionValidated: lastCond ? lastConditionValidated : false,
      currentLease,
    });
  }

  return results;
}

/**
 * Portfolio-level renovation opportunities: all at-risk assets across a building's units.
 * Includes assets where recommendation !== REPAIR or last condition is POOR/DAMAGED.
 */
export async function getBuildingRenovationOpportunities(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
): Promise<RenovationOpportunity[]> {
  const building = await prisma.building.findFirst({
    where: { id: buildingId, orgId },
    select: { canton: true },
  });
  if (!building) throw new Error(`Building ${buildingId} not found`);

  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true, unitNumber: true },
    orderBy: { unitNumber: "asc" },
  });

  const opportunities: RenovationOpportunity[] = [];
  for (const unit of units) {
    try {
      const items = await getRepairReplaceAnalysis(prisma, orgId, unit.id, building.canton);
      for (const item of items) {
        if (item.recommendation !== "REPAIR" || item.lastConditionStatus === "POOR" || item.lastConditionStatus === "DAMAGED") {
          opportunities.push({ ...item, unitId: unit.id, unitNumber: unit.unitNumber });
        }
      }
    } catch { /* skip units where analysis fails */ }
  }

  const order: Record<string, number> = { REPLACE: 0, PLAN_REPLACEMENT: 1, MONITOR: 2, REPAIR: 3 };
  opportunities.sort((a, b) => {
    const diff = (order[a.recommendation] ?? 3) - (order[b.recommendation] ?? 3);
    return diff !== 0 ? diff : (b.depreciationPct ?? 0) - (a.depreciationPct ?? 0);
  });
  return opportunities;
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
