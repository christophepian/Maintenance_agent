/**
 * CapEx Projection Service
 *
 * Produces a 5-year per-building CapEx forecast that combines:
 *   - Asset depreciation timelines (from assetInventory.ts)
 *   - Tax classification (from taxClassificationService.ts)
 *   - Replacement cost estimates (from replacementCostService.ts)
 *   - Multi-year bundling optimization
 *
 * Layer: service (orchestrates other services — no direct Prisma calls).
 */

import { PrismaClient, AssetType, TaxClassification } from "@prisma/client";
import { listBuildings, findBuildingOwnersWithTaxRate } from "../repositories/inventoryRepository";
import {
  getAssetInventoryForBuilding,
  AssetInventoryItem,
  computeDepreciation,
} from "./assetInventory";
import { classifyAsset, TaxClassificationResult } from "./taxClassificationService";
import {
  estimateReplacementCost,
  ReplacementCostEstimate,
} from "./replacementCostService";
import {
  computeTimingPairSavings,
} from "./swissTaxBrackets";

// ─── Types ─────────────────────────────────────────────────────

export interface AssetProjectionItem {
  assetId: string;
  assetName: string;
  assetType: AssetType;
  topic: string;
  unitId: string;
  unitNumber?: string;
  // Depreciation timeline
  depreciationPct: number | null;
  residualPct: number | null;
  usefulLifeMonths: number | null;
  ageMonths: number | null;
  estimatedReplacementYear: number | null;
  // Tax classification
  taxClassification: TaxClassification | null;
  deductiblePct: number;
  taxConfidence: number;
  taxSource: string;
  // Cost estimate
  estimatedCostChf: number;
  costRange: { lowChf: number; medianChf: number; highChf: number } | null;
  costConfidence: number;
}

export interface YearlyCapExBucket {
  year: number;
  totalChf: number;
  deductibleChf: number;
  capitalizedChf: number;
  assetCount: number;
  items: AssetProjectionItem[];
}

export interface BuildingCapExProjection {
  buildingId: string;
  buildingName: string;
  canton: string | null;
  totalProjectedChf: number;
  totalDeductibleChf: number;
  totalCapitalizedChf: number;
  projectedAssetCount: number;
  yearlyBuckets: YearlyCapExBucket[];
  // Bundling recommendations
  bundlingAdvice: BundlingRecommendation[];
}

export interface BundlingSavingsBreakdown {
  category: string;        // e.g. "Shared mobilization", "Bulk procurement"
  estimatedPct: number;    // % savings from this category
  explanation: string;     // human-readable explanation
}

export interface BundlingRecommendation {
  yearRange: string; // e.g. "2026-2027"
  combinedCostChf: number;
  savingsEstimatePct: number; // % savings from bundling
  estimatedSavingsChf: number;
  assetCount: number;
  // Enriched detail
  assetBreakdown: Array<{ type: string; topic: string; count: number; totalChf: number }>;
  affectedUnits: string[];    // unit numbers involved
  tradeGroups: string[];      // contractor trade types, e.g. ["Plumbing", "Electrical"]
  savingsBreakdown: BundlingSavingsBreakdown[];
  rationale: string;
}

export interface CapExPortfolioProjection {
  projectionHorizonYears: number;
  fromYear: number;
  toYear: number;
  totalProjectedChf: number;
  totalDeductibleChf: number;
  totalCapitalizedChf: number;
  buildings: BuildingCapExProjection[];
  yearlyTotals: Array<{
    year: number;
    totalChf: number;
    deductibleChf: number;
    capitalizedChf: number;
  }>;
  timingRecommendations: TimingRecommendation[];
}

// ─── Timing Recommendation Types ───────────────────────────────

export interface TimingRecommendation {
  buildingId: string;
  buildingName: string;
  assetId: string;
  assetName: string;
  assetType: string;
  topic: string;
  unitNumber: string | null;
  /** Scheduled replacement year (based on depreciation) */
  scheduledYear: number;
  /** Recommended year (may differ for tax-shield reasons) */
  recommendedYear: number;
  /** Direction: "advance" (bring forward) or "defer" (push back) */
  direction: "advance" | "defer";
  /** Estimated cost of this replacement */
  estimatedCostChf: number;
  /** Whether this item is tax-deductible (value-preserving) */
  isDeductible: boolean;
  /** Deductible percentage */
  deductiblePct: number;
  /** Owner's marginal tax rate, null if not configured */
  ownerMarginalTaxRate: number | null;
  /** Estimated tax saving from scheduling in the recommended year */
  estimatedTaxSavingChf: number;
  /** Human-readable rationale */
  rationale: string;
  // ─── Bracket-based comparison fields ──────────────────────
  /** Projected rental income in the scheduled year (CHF) */
  scheduledYearIncomeChf: number;
  /** Projected rental income in the recommended year (CHF) */
  recommendedYearIncomeChf: number;
  /** Tax saving on the deductible amount if replaced in scheduled year */
  taxSavingScheduledChf: number;
  /** Tax saving on the deductible amount if replaced in recommended year */
  taxSavingRecommendedChf: number;
  /** Difference: recommended minus scheduled (positive = better in recommended year) */
  additionalSavingChf: number;
  /** Combined marginal tax rate at the scheduled-year income level */
  scheduledYearMarginalPct: number;
  /** Combined marginal tax rate at the recommended-year income level */
  recommendedYearMarginalPct: number;
  /** Source label, e.g. "Federal 2026 + ZH 2026 brackets" or "flat 25%" */
  bracketSource: string;
}

// ─── Constants ─────────────────────────────────────────────────

const PROJECTION_HORIZON_YEARS = 5;
const BUNDLING_WINDOW_YEARS = 2;

/** Default Swiss marginal tax rate used when owner hasn't configured one */
const DEFAULT_MARGINAL_TAX_RATE_PCT = 25;

/** Minimum deductible cost to generate a timing recommendation (CHF) */
const TIMING_MIN_COST_CHF = 1000;

/** Maximum years to advance or defer a replacement */
const TIMING_FLEX_YEARS = 2;

/** Trade group mapping — maps AssetType to contractor trade */
const TRADE_GROUP: Record<string, string> = {
  APPLIANCE: "Appliance technician",
  FIXTURE: "Plumbing / bathroom fitter",
  FINISH: "Painter / floor specialist",
  STRUCTURAL: "General contractor",
  SYSTEM: "HVAC / electrical",
  OTHER: "General contractor",
};

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Estimate which year an asset will need replacement based on depreciation.
 * Returns null if no depreciation data.
 */
function estimateReplacementYear(
  dep: { depreciationPct: number; usefulLifeMonths: number; ageMonths: number } | null,
): number | null {
  if (!dep) return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  if (dep.depreciationPct >= 100) {
    // Already past EOL — should be replaced this year
    return currentYear;
  }

  const remainingMonths = dep.usefulLifeMonths - dep.ageMonths;
  const remainingYears = Math.max(0, Math.ceil(remainingMonths / 12));
  return currentYear + remainingYears;
}

// ─── Per-Building Projection ───────────────────────────────────

async function projectBuilding(
  prisma: PrismaClient,
  orgId: string,
  building: { id: string; name: string; canton: string | null },
  fromYear: number,
  toYear: number,
): Promise<BuildingCapExProjection> {
  const assets = await getAssetInventoryForBuilding(
    prisma, orgId, building.id, { canton: building.canton },
  );

  // Cache for tax + cost lookups (by "assetType::topic")
  const taxCache = new Map<string, TaxClassificationResult>();
  const costCache = new Map<string, ReplacementCostEstimate>();

  // Project each asset
  const projectedItems: AssetProjectionItem[] = [];

  for (const asset of assets) {
    const dep = asset.depreciation;
    const replacementYear = estimateReplacementYear(
      dep ? { depreciationPct: dep.depreciationPct, usefulLifeMonths: dep.usefulLifeMonths, ageMonths: dep.ageMonths } : null,
    );

    // Skip assets that don't need replacement within the horizon
    if (replacementYear === null || replacementYear > toYear) continue;

    const key = `${asset.type}::${asset.topic}`;

    // Tax classification (cached)
    let tax = taxCache.get(key);
    if (!tax) {
      tax = await classifyAsset(prisma, asset.type as AssetType, asset.topic, building.canton);
      taxCache.set(key, tax);
    }

    // Cost estimate (cached)
    let cost = costCache.get(key);
    if (!cost) {
      cost = await estimateReplacementCost(prisma, orgId, asset.type as AssetType, asset.topic);
      costCache.set(key, cost);
    }

    const estimatedCostChf = cost.bestEstimate.medianChf;

    projectedItems.push({
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type as AssetType,
      topic: asset.topic,
      unitId: asset.unitId,
      unitNumber: asset.unit?.unitNumber,
      depreciationPct: dep?.depreciationPct ?? null,
      residualPct: dep?.residualPct ?? null,
      usefulLifeMonths: dep?.usefulLifeMonths ?? null,
      ageMonths: dep?.ageMonths ?? null,
      estimatedReplacementYear: replacementYear,
      taxClassification: tax.classification,
      deductiblePct: tax.deductiblePct,
      taxConfidence: tax.confidence,
      taxSource: tax.source,
      estimatedCostChf,
      costRange: cost.bestEstimate.medianChf > 0 ? cost.bestEstimate : null,
      costConfidence: cost.confidence,
    });
  }

  // Bucket by year
  const yearlyBuckets: YearlyCapExBucket[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    const items = projectedItems.filter((i) => i.estimatedReplacementYear === year);
    const totalChf = items.reduce((s, i) => s + i.estimatedCostChf, 0);
    const deductibleChf = items.reduce(
      (s, i) => s + Math.round(i.estimatedCostChf * i.deductiblePct / 100), 0,
    );
    const capitalizedChf = totalChf - deductibleChf;

    yearlyBuckets.push({
      year,
      totalChf,
      deductibleChf,
      capitalizedChf,
      assetCount: items.length,
      items,
    });
  }

  // Bundling recommendations
  const bundlingAdvice = computeBundlingAdvice(yearlyBuckets);

  const totalProjectedChf = yearlyBuckets.reduce((s, b) => s + b.totalChf, 0);
  const totalDeductibleChf = yearlyBuckets.reduce((s, b) => s + b.deductibleChf, 0);

  return {
    buildingId: building.id,
    buildingName: building.name,
    canton: building.canton,
    totalProjectedChf,
    totalDeductibleChf,
    totalCapitalizedChf: totalProjectedChf - totalDeductibleChf,
    projectedAssetCount: projectedItems.length,
    yearlyBuckets,
    bundlingAdvice,
  };
}

// ─── Bundling Optimizer ────────────────────────────────────────

/**
 * Identifies consecutive years with replacements that could be bundled
 * together for contractor efficiency savings. Enriches each recommendation
 * with specific asset types, affected units, trade groups, and a
 * transparent savings breakdown.
 */
function computeBundlingAdvice(
  buckets: YearlyCapExBucket[],
): BundlingRecommendation[] {
  const advice: BundlingRecommendation[] = [];

  for (let i = 0; i < buckets.length - 1; i++) {
    const current = buckets[i];
    const next = buckets[i + 1];

    // Look for consecutive years both having work
    if (current.assetCount > 0 && next.assetCount > 0) {
      const allItems = [...current.items, ...next.items];
      const totalAssets = allItems.length;

      // Only recommend bundling if there are at least 3 assets total
      if (totalAssets < 3) continue;

      const combinedCost = current.totalChf + next.totalChf;

      // ── Asset breakdown: group by type+topic ──
      const byKey = new Map<string, { type: string; topic: string; count: number; totalChf: number }>();
      for (const item of allItems) {
        const key = `${item.assetType}::${item.topic}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.count++;
          existing.totalChf += item.estimatedCostChf;
        } else {
          byKey.set(key, { type: item.assetType, topic: item.topic, count: 1, totalChf: item.estimatedCostChf });
        }
      }
      const assetBreakdown = [...byKey.values()].sort((a, b) => b.totalChf - a.totalChf);

      // ── Affected units ──
      const unitSet = new Set<string>();
      for (const item of allItems) {
        if (item.unitNumber) unitSet.add(item.unitNumber);
      }
      const affectedUnits = [...unitSet].sort();

      // ── Trade groups ──
      const tradeSet = new Set<string>();
      for (const item of allItems) {
        tradeSet.add(TRADE_GROUP[item.assetType] || TRADE_GROUP.OTHER);
      }
      const tradeGroups = [...tradeSet].sort();

      // ── Savings breakdown (transparent, auditable) ──
      const savingsBreakdown: BundlingSavingsBreakdown[] = [];

      // 1. Shared mobilization: 1 site visit instead of N
      const mobilisationPct = Math.min(4, Math.round(1 + affectedUnits.length * 0.5));
      savingsBreakdown.push({
        category: "Shared mobilization",
        estimatedPct: mobilisationPct,
        explanation:
          `${affectedUnits.length} unit${affectedUnits.length > 1 ? "s" : ""} serviced in one visit instead of separate call-outs. ` +
          `Each mobilization typically costs CHF 150–300; bundling eliminates ${Math.max(1, affectedUnits.length - 1)} repeat visit${affectedUnits.length > 2 ? "s" : ""}.`,
      });

      // 2. Bulk procurement: duplicate asset types
      const duplicateTypes = assetBreakdown.filter(a => a.count >= 2);
      if (duplicateTypes.length > 0) {
        const bulkPct = Math.min(5, duplicateTypes.length * 2);
        const examples = duplicateTypes.slice(0, 3).map(d =>
          `${d.count}× ${d.topic.replace(/_/g, " ").toLowerCase()}`
        ).join(", ");
        savingsBreakdown.push({
          category: "Bulk procurement",
          estimatedPct: bulkPct,
          explanation:
            `Identical equipment ordered in bulk (${examples}) qualifies for supplier volume discounts, ` +
            `typically 5–15% on parts. Applied conservatively at ${bulkPct}% of total.`,
        });
      }

      // 3. Same-trade contractor: if same trade handles multiple assets
      if (tradeGroups.length === 1 && totalAssets >= 3) {
        savingsBreakdown.push({
          category: "Single-trade efficiency",
          estimatedPct: 2,
          explanation:
            `All ${totalAssets} replacements fall under "${tradeGroups[0]}" — a single contractor can batch the work, ` +
            `reducing overhead from coordinating multiple trades.`,
        });
      }

      const totalSavingsPct = savingsBreakdown.reduce((s, b) => s + b.estimatedPct, 0);
      const estimatedSavingsChf = Math.round(combinedCost * totalSavingsPct / 100);

      // ── Readable rationale (summary) ──
      const assetList = assetBreakdown.slice(0, 4).map(a =>
        `${a.count}× ${a.topic.replace(/_/g, " ")}`
      ).join(", ");
      const truncated = assetBreakdown.length > 4 ? ` + ${assetBreakdown.length - 4} more` : "";
      const savingsDetail = savingsBreakdown.map(s => `${s.category} (~${s.estimatedPct}%)`).join(" + ");

      advice.push({
        yearRange: `${current.year}-${next.year}`,
        combinedCostChf: combinedCost,
        savingsEstimatePct: totalSavingsPct,
        estimatedSavingsChf,
        assetCount: totalAssets,
        assetBreakdown,
        affectedUnits,
        tradeGroups,
        savingsBreakdown,
        rationale:
          `Bundle ${totalAssets} replacements (${assetList}${truncated}) across ${affectedUnits.length} unit${affectedUnits.length > 1 ? "s" : ""}. ` +
          `Estimated ~${totalSavingsPct}% savings (CHF ${estimatedSavingsChf.toLocaleString("de-CH")}) from: ${savingsDetail}.`,
      });
    }
  }

  return advice;
}

// ─── Timing Flexibility Advisor ────────────────────────────────

/**
 * Identifies deductible replacements that are not yet at end-of-life and
 * recommends whether to advance or defer them for optimal tax-shield timing.
 *
 * Strategy:
 *   - For deductible items (value-preserving), the tax deduction is most
 *     valuable in years with higher rental income.
 *   - Uses per-year projected income from BuildingFinancialSnapshot to
 *     identify which years have higher vs lower income.
 *   - Only recommends changes if the asset has timing flexibility
 *     (depreciation between 60-95%, meaning 1-2 years before EOL).
 */
async function computeTimingRecommendations(
  prisma: PrismaClient,
  orgId: string,
  buildingProjections: BuildingCapExProjection[],
  fromYear: number,
  toYear: number,
): Promise<TimingRecommendation[]> {
  const recommendations: TimingRecommendation[] = [];

  for (const bp of buildingProjections) {
    // Get owner's marginal tax rate for this building
    const owners = await findBuildingOwnersWithTaxRate(prisma, bp.buildingId);
    // Use the first owner's rate, or default
    const ownerRate = owners.length > 0 && owners[0].user.marginalTaxRate != null
      ? owners[0].user.marginalTaxRate
      : null;
    const effectiveRate = ownerRate ?? DEFAULT_MARGINAL_TAX_RATE_PCT;

    // Get projected income per year for this building from financial snapshots
    const snapshots = await prisma.buildingFinancialSnapshot.findMany({
      where: {
        orgId,
        buildingId: bp.buildingId,
        periodStart: { gte: new Date(`${fromYear}-01-01`) },
        periodEnd: { lte: new Date(`${toYear + 1}-01-01`) },
      },
      select: { periodStart: true, projectedIncomeCents: true },
      orderBy: { periodStart: "asc" },
    });

    // Aggregate projected income per year
    const yearlyIncome = new Map<number, number>();
    for (const snap of snapshots) {
      const year = snap.periodStart.getFullYear();
      yearlyIncome.set(year, (yearlyIncome.get(year) || 0) + snap.projectedIncomeCents);
    }

    // If no income data at all, use current leases as proxy
    if (yearlyIncome.size === 0) {
      const leases = await prisma.lease.findMany({
        where: {
          unit: { buildingId: bp.buildingId },
          status: "ACTIVE",
        },
        select: { rentTotalChf: true },
      });
      const annualRent = leases.reduce((s, l) => s + (l.rentTotalChf || 0) * 12 * 100, 0);
      if (annualRent > 0) {
        for (let y = fromYear; y <= toYear; y++) {
          yearlyIncome.set(y, annualRent);
        }
      }
    }

    // Find the average income to identify high/low income years
    const incomeValues = [...yearlyIncome.values()];
    const avgIncome = incomeValues.length > 0
      ? incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length
      : 0;

    // Scan all projected items with timing flexibility
    for (const bucket of bp.yearlyBuckets) {
      for (const item of bucket.items) {
        // Only consider deductible items (value-preserving) with meaningful cost
        if (item.deductiblePct < 50) continue;
        if (item.estimatedCostChf < TIMING_MIN_COST_CHF) continue;

        // Must have depreciation data showing flexibility
        if (item.depreciationPct == null) continue;

        // Asset must have some life remaining (not already overdue)
        // and not too far from EOL (otherwise timing doesn't matter)
        const hasFlexibility = item.depreciationPct >= 50 && item.depreciationPct < 95;
        if (!hasFlexibility) continue;

        const scheduledYear = item.estimatedReplacementYear;
        if (scheduledYear == null) continue;

        // Find the best year to schedule this within ±TIMING_FLEX_YEARS
        const deductibleAmount = item.estimatedCostChf * item.deductiblePct / 100;
        let bestYear = scheduledYear;
        let bestIncome = yearlyIncome.get(scheduledYear) || 0;

        for (let y = Math.max(fromYear, scheduledYear - TIMING_FLEX_YEARS);
          y <= Math.min(toYear, scheduledYear + TIMING_FLEX_YEARS); y++) {
          const income = yearlyIncome.get(y) || 0;
          if (income > bestIncome) {
            bestIncome = income;
            bestYear = y;
          }
        }

        // Only recommend if a different year is materially better
        if (bestYear === scheduledYear) continue;

        const scheduledIncome = yearlyIncome.get(scheduledYear) || 0;
        // Income must be at least 5% higher to warrant a recommendation
        if (scheduledIncome > 0 && (bestIncome - scheduledIncome) / scheduledIncome < 0.05) continue;

        const direction = bestYear < scheduledYear ? "advance" as const : "defer" as const;

        // ─── Bracket-based tax saving comparison ─────────────
        const scheduledIncomeChf = Math.round(scheduledIncome / 100); // cents → CHF
        const recommendedIncomeChf = Math.round(bestIncome / 100);    // cents → CHF

        const pairSavings = computeTimingPairSavings(
          scheduledIncomeChf, recommendedIncomeChf,
          deductibleAmount, bp.canton, effectiveRate,
        );

        const additionalSaving = pairSavings.recommendedSavingChf - pairSavings.scheduledSavingChf;
        const taxSavingFromTiming = pairSavings.recommendedSavingChf;

        const directionLabel = direction === "advance" ? "Advance" : "Defer";
        const yearDiff = Math.abs(bestYear - scheduledYear);
        const incomeContext = avgIncome > 0
          ? ` when projected rental income is ${Math.round((bestIncome / avgIncome - 1) * 100)}% above average`
          : "";

        recommendations.push({
          buildingId: bp.buildingId,
          buildingName: bp.buildingName,
          assetId: item.assetId,
          assetName: item.assetName,
          assetType: item.assetType,
          topic: item.topic,
          unitNumber: item.unitNumber || null,
          scheduledYear,
          recommendedYear: bestYear,
          direction,
          estimatedCostChf: item.estimatedCostChf,
          isDeductible: item.deductiblePct >= 50,
          deductiblePct: item.deductiblePct,
          ownerMarginalTaxRate: ownerRate,
          estimatedTaxSavingChf: taxSavingFromTiming,
          rationale:
            `${directionLabel} ${item.assetName.toLowerCase()} replacement by ${yearDiff} year${yearDiff > 1 ? "s" : ""} ` +
            `to ${bestYear}${incomeContext}. ` +
            `Deductible portion: CHF ${deductibleAmount.toLocaleString("en-CH")} at ` +
            `${ownerRate != null ? `owner's ${effectiveRate}%` : `default ${effectiveRate}%`} marginal rate ` +
            `yields ~CHF ${taxSavingFromTiming.toLocaleString("en-CH")} tax shield.`,
          // Bracket-based comparison data
          scheduledYearIncomeChf: scheduledIncomeChf,
          recommendedYearIncomeChf: recommendedIncomeChf,
          taxSavingScheduledChf: pairSavings.scheduledSavingChf,
          taxSavingRecommendedChf: pairSavings.recommendedSavingChf,
          additionalSavingChf: additionalSaving,
          scheduledYearMarginalPct: pairSavings.scheduledMarginalPct,
          recommendedYearMarginalPct: pairSavings.recommendedMarginalPct,
          bracketSource: pairSavings.source,
        });
      }
    }
  }

  // Sort by estimated tax saving descending
  recommendations.sort((a, b) => b.estimatedTaxSavingChf - a.estimatedTaxSavingChf);
  return recommendations;
}

// ─── Portfolio Projection (Public API) ─────────────────────────

/**
 * Compute the full CapEx projection for a portfolio.
 *
 * Steps:
 *   1. Fetch all buildings
 *   2. For each building, project replacements over 5 years
 *   3. Apply tax classification + cost estimates
 *   4. Compute bundling recommendations
 *   5. Aggregate into portfolio summary
 */
export async function getCapExProjection(
  prisma: PrismaClient,
  orgId: string,
  options: { horizonYears?: number } = {},
): Promise<CapExPortfolioProjection> {
  const horizonYears = options.horizonYears ?? PROJECTION_HORIZON_YEARS;
  const currentYear = new Date().getFullYear();
  const fromYear = currentYear;
  const toYear = currentYear + horizonYears - 1;

  // 1. Fetch buildings
  const buildings = await listBuildings(prisma, orgId);

  // 2-4. Project each building
  const buildingProjections: BuildingCapExProjection[] = [];
  for (const building of buildings) {
    const projection = await projectBuilding(prisma, orgId, building, fromYear, toYear);
    buildingProjections.push(projection);
  }

  // 5. Portfolio totals
  const totalProjectedChf = buildingProjections.reduce((s, b) => s + b.totalProjectedChf, 0);
  const totalDeductibleChf = buildingProjections.reduce((s, b) => s + b.totalDeductibleChf, 0);

  // Yearly totals across all buildings
  const yearlyTotals: Array<{
    year: number;
    totalChf: number;
    deductibleChf: number;
    capitalizedChf: number;
  }> = [];

  for (let year = fromYear; year <= toYear; year++) {
    let total = 0;
    let deductible = 0;
    for (const bp of buildingProjections) {
      const bucket = bp.yearlyBuckets.find((b) => b.year === year);
      if (bucket) {
        total += bucket.totalChf;
        deductible += bucket.deductibleChf;
      }
    }
    yearlyTotals.push({
      year,
      totalChf: total,
      deductibleChf: deductible,
      capitalizedChf: total - deductible,
    });
  }

  // 6. Timing flexibility recommendations
  const timingRecommendations = await computeTimingRecommendations(
    prisma, orgId, buildingProjections, fromYear, toYear,
  );

  return {
    projectionHorizonYears: horizonYears,
    fromYear,
    toYear,
    totalProjectedChf,
    totalDeductibleChf,
    totalCapitalizedChf: totalProjectedChf - totalDeductibleChf,
    buildings: buildingProjections,
    yearlyTotals,
    timingRecommendations,
  };
}
