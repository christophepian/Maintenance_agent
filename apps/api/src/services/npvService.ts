/**
 * NPV Scenarios Service — Phase 3 Financial Planning
 *
 * Combines projected NOI (from BuildingFinancialSnapshot history + income growth)
 * with the forward capex schedule to produce three investment scenarios:
 *
 *   Invest  — full capex executed on the depreciation schedule
 *   Defer   — near-term capex pushed back by `deferYears` (default 3)
 *   Neglect — zero capex for the entire horizon (deferred liability only)
 *
 * All monetary values are in CHF. Discount is applied annually using standard DCF.
 * Tax shield: deductible (value-preserving) capex reduces the owner's taxable income
 * in the year it is expensed. After-tax capex = gross × (1 − deductiblePct × marginalRate).
 * Neglect receives no tax shield since no consented work is carried out.
 *
 * FCI (Facility Condition Index): deferred maintenance cost / total replacement value.
 * Industry benchmarks: <5% excellent, 5–10% good, 10–30% fair, >30% critical (BOMA/CBRE).
 *
 * Layer: service (orchestrates repository + capexProjectionService — no direct Prisma calls
 * beyond the NOI snapshot lookup delegated to the repository).
 */

import { PrismaClient, AssetType } from "@prisma/client";
import { getAssetInventoryForBuilding } from "./assetInventory";
import { estimateReplacementCost } from "./replacementCostService";
import { classifyAsset } from "./taxClassificationService";
import { findAllSnapshotsForBuilding } from "../repositories/buildingFinancialSnapshotRepository";
import { findBuildingByIdAndOrg, findBuildingOwnersWithTaxRate } from "../repositories/inventoryRepository";
import { findRentIncomeLeasesForBuilding } from "../repositories/leaseRepository";

// ─── Constants ────────────────────────────────────────────────────

/** Fallback marginal tax rate when the owner hasn't configured one (Swiss average) */
const DEFAULT_MARGINAL_TAX_RATE_PCT = 25;

// ─── Public types ──────────────────────────────────────────────

export interface NPVYearlyFlow {
  year: number;
  projectedNoiChf: number;
  capexChf: number;
  /** Tax shield benefit from deductible capex in this year (0 for Neglect) */
  taxShieldChf: number;
  netCashFlowChf: number;
  discountFactor: number;
  pvChf: number;
  cumulativePvChf: number;
}

export interface NPVScenarioResult {
  npvChf: number;
  totalCapexChf: number;
  /** Sum of annual tax shield benefits across the horizon */
  totalTaxShieldChf: number;
  totalNoiChf: number;
  /** PV of terminal property sale value included in npvChf (0 when not modeled) */
  terminalValuePvChf: number;
  yearlyFlows: NPVYearlyFlow[];
}

export interface NPVScenariosResult {
  buildingId: string;
  buildingName: string;
  discountRatePct: number;
  incomeGrowthRatePct: number;
  horizonYears: number;
  deferYears: number;
  baseAnnualNoiChf: number;
  /** True when no income history was found (NOI estimated from leases or defaulted to 0) */
  noIncomeData: boolean;
  fromYear: number;
  toYear: number;
  scenarios: {
    invest: NPVScenarioResult;
    defer: NPVScenarioResult;
    neglect: NPVScenarioResult;
  };
  /** True when property value was provided and terminal sale value is included in scenario NPVs */
  terminalValueModeled: boolean;
  /** Estimated property value used for terminal value computation, if provided */
  propertyValueChf?: number;
  /** Annual NOI erosion rate applied to the Neglect scenario, % (default 1) */
  neglectNoiErosionRatePct: number;
  // ─── Tax shield ──────────────────────────────────────────────
  /** Marginal tax rate used for shield computation (owner-configured or default), % */
  ownerMarginalTaxRatePct: number;
  /** True when the owner has not configured a marginal tax rate — default was used */
  ownerTaxRateIsDefault: boolean;
  // ─── FCI ─────────────────────────────────────────────────────
  /**
   * Facility Condition Index — deferred maintenance cost / total asset replacement value, %.
   * Current: overdue assets only. Benchmarks: <5 excellent, 5–10 good, 10–30 fair, >30 critical.
   */
  fciCurrentPct: number;
  /**
   * Projected FCI at end of horizon under the Neglect scenario (all within-horizon capex deferred).
   */
  fciNeglectHorizonPct: number;
  /** Sum of replacement cost estimates for all depreciable assets in the building (FCI denominator) */
  totalReplacementValueChf: number;
}

export interface NPVOptions {
  /** Annual discount rate, % — default 4 (Swiss private real-estate benchmark) */
  discountRatePct?: number;
  /** Annual income growth rate applied to projected NOI, % — default 2 */
  incomeGrowthRatePct?: number;
  /** Forward projection horizon in years — default 10 */
  horizonYears?: number;
  /** Years by which near-term replacements are deferred in the Defer scenario — default 3 */
  deferYears?: number;
  /** Current market / appraisal value of the building in CHF — enables terminal value modeling */
  propertyValueChf?: number;
  /** Annual NOI erosion rate for the Neglect scenario, % — default 1 */
  neglectNoiErosionRatePct?: number;
}

// ─── Helpers ───────────────────────────────────────────────────

function discountFactor(ratePct: number, yearsAhead: number): number {
  if (ratePct === 0) return 1;
  return 1 / Math.pow(1 + ratePct / 100, yearsAhead);
}

function growthFactor(ratePct: number, yearsAhead: number): number {
  if (ratePct === 0) return 1;
  return Math.pow(1 + ratePct / 100, yearsAhead);
}

function buildScenario(
  fromYear: number,
  toYear: number,
  baseAnnualNoiChf: number,
  incomeGrowthRatePct: number,
  discountRatePct: number,
  capexByYear: Map<number, number>,
  opts?: {
    /** Annual NOI erosion applied after erosionStartOffset years, % */
    noiErosionRatePct?: number;
    /** yearsAhead offset after which erosion begins (inclusive) */
    erosionStartOffset?: number;
    /** Property value at horizon end — discounted and added to NPV */
    terminalValueChf?: number;
    /**
     * Tax shield benefit per year: deductible capex × owner marginal rate.
     * Added to net cash flow in the year the work is expensed.
     * Not passed for Neglect (no consented work = no deduction).
     */
    taxShieldByYear?: Map<number, number>;
  },
): NPVScenarioResult {
  const flows: NPVYearlyFlow[] = [];
  let cumulativePvChf = 0;

  for (let year = fromYear; year <= toYear; year++) {
    const yearsAhead = year - fromYear;

    // NOI with optional erosion after erosionStartOffset years
    const erosionOffset = opts?.erosionStartOffset ?? 0;
    const erosionYears = (opts?.noiErosionRatePct && yearsAhead > erosionOffset)
      ? yearsAhead - erosionOffset
      : 0;
    const erosionFactor = erosionYears > 0 && opts?.noiErosionRatePct
      ? Math.pow(1 - opts.noiErosionRatePct / 100, erosionYears)
      : 1;
    const projectedNoiChf = Math.round(
      baseAnnualNoiChf * growthFactor(incomeGrowthRatePct, yearsAhead) * erosionFactor,
    );

    const capexChf = capexByYear.get(year) ?? 0;
    const taxShieldChf = opts?.taxShieldByYear?.get(year) ?? 0;
    const netCashFlowChf = projectedNoiChf - capexChf + taxShieldChf;
    const df = discountFactor(discountRatePct, yearsAhead + 1);
    const pvChf = Math.round(netCashFlowChf * df);
    cumulativePvChf += pvChf;

    flows.push({
      year,
      projectedNoiChf,
      capexChf,
      taxShieldChf,
      netCashFlowChf,
      discountFactor: Math.round(df * 10000) / 10000,
      pvChf,
      cumulativePvChf,
    });
  }

  const totalNoiChf = flows.reduce((s, f) => s + f.projectedNoiChf, 0);
  const totalCapexChf = flows.reduce((s, f) => s + f.capexChf, 0);
  const totalTaxShieldChf = flows.reduce((s, f) => s + f.taxShieldChf, 0);
  const cashFlowNpvChf = flows.reduce((s, f) => s + f.pvChf, 0);

  // Terminal sale value — discounted from end of horizon (after last cash flow)
  let terminalValuePvChf = 0;
  if (opts?.terminalValueChf != null) {
    const horizonLength = toYear - fromYear + 1;
    terminalValuePvChf = Math.round(
      opts.terminalValueChf * discountFactor(discountRatePct, horizonLength),
    );
  }

  const npvChf = cashFlowNpvChf + terminalValuePvChf;

  return { npvChf, totalCapexChf, totalTaxShieldChf, totalNoiChf, terminalValuePvChf, yearlyFlows: flows };
}

// ─── Main function ─────────────────────────────────────────────

export async function computeNPVScenarios(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  options: NPVOptions = {},
): Promise<NPVScenariosResult> {
  const discountRatePct = options.discountRatePct ?? 4;
  const incomeGrowthRatePct = options.incomeGrowthRatePct ?? 2;
  const horizonYears = Math.min(20, Math.max(1, options.horizonYears ?? 10));
  const deferYears = Math.min(10, Math.max(1, options.deferYears ?? 3));
  const propertyValueChf = (options.propertyValueChf != null && options.propertyValueChf > 0)
    ? options.propertyValueChf : undefined;
  const neglectNoiErosionRatePct = options.neglectNoiErosionRatePct ?? 1;
  const terminalValueModeled = propertyValueChf != null;

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear;
  const toYear = currentYear + horizonYears - 1;

  // ── 1. Verify building ─────────────────────────────────────────
  const building = await findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) {
    throw Object.assign(new Error(`Building ${buildingId} not found`), { statusCode: 404 });
  }

  // ── 2. Owner marginal tax rate ─────────────────────────────────
  // Used to compute tax shield on deductible capex for Invest and Defer scenarios.
  const owners = await findBuildingOwnersWithTaxRate(prisma, buildingId);
  const ownerRate = owners.length > 0 && owners[0].user.marginalTaxRate != null
    ? owners[0].user.marginalTaxRate
    : null;
  const ownerMarginalTaxRatePct = ownerRate ?? DEFAULT_MARGINAL_TAX_RATE_PCT;
  const ownerTaxRateIsDefault = ownerRate === null;

  // ── 3. Base annual NOI from most recent full-year snapshot ─────
  const snapshots = await findAllSnapshotsForBuilding(prisma, orgId, buildingId);

  // Use the most recent snapshot that covers a full calendar year
  const annualSnapshots = snapshots.filter((s) => {
    const start = new Date(s.periodStart);
    const end = new Date(s.periodEnd);
    return (
      start.getMonth() === 0 && start.getDate() === 1 &&
      end.getMonth() === 11 && end.getDate() === 31 &&
      end.getFullYear() < currentYear
    );
  });

  let baseAnnualNoiChf = 0;
  let noIncomeData = false;

  if (annualSnapshots.length > 0) {
    // Best case: a full Jan 1–Dec 31 snapshot from a prior year
    const latest = annualSnapshots[annualSnapshots.length - 1];
    baseAnnualNoiChf = Math.round(Number(latest.netOperatingIncomeCents) / 100);
  } else if (snapshots.length > 0) {
    // Fallback A: annualize whatever snapshot history exists (any period length)
    const today = new Date();
    const relevant = snapshots.filter((s) => new Date(s.periodEnd) <= today);
    if (relevant.length > 0) {
      const totalNoiCents = relevant.reduce(
        (s, snap) => s + Number(snap.netOperatingIncomeCents), 0,
      );
      const startMs = new Date(relevant[0].periodStart).getTime();
      const endMs = new Date(relevant[relevant.length - 1].periodEnd).getTime();
      const totalDays = Math.max(1, (endMs - startMs) / (1000 * 60 * 60 * 24));
      if (totalDays >= 30) {
        baseAnnualNoiChf = Math.round((totalNoiCents / 100) * (365 / totalDays));
      }
    }
  }

  if (baseAnnualNoiChf === 0) {
    // Fallback B: active lease rent as proxy for annual gross income
    const leases = await findRentIncomeLeasesForBuilding(prisma, orgId, buildingId);
    baseAnnualNoiChf = Math.round(
      leases.reduce((s, l) => s + (l.rentTotalChf ?? 0), 0) * 12,
    );
    noIncomeData = baseAnnualNoiChf === 0;
  }

  // ── 4. Asset inventory → capex items + FCI accumulators ───────
  // We bypass getCapExProjection/projectBuilding because those go through
  // listBuildings() which filters isActive=true and may exclude this building.
  //
  // Two-phase loop:
  //   All assets  → cost estimate → contribute to FCI denominator (totalReplacementValueChf)
  //   Within-horizon assets only → also get tax classification → pushed to allItems
  const extendedHorizon = horizonYears + deferYears;
  const extendedToYear = currentYear + extendedHorizon - 1;

  const buildingAssets = await getAssetInventoryForBuilding(prisma, orgId, buildingId, {
    canton: building.canton ?? null,
  });

  // Caches: keyed by "assetType::topic" to avoid duplicate DB lookups
  const costCache = new Map<string, number>();
  const taxCache = new Map<string, number>(); // stores deductiblePct

  interface CapexItem {
    assetId: string;
    assetName: string;
    topic: string;
    estimatedReplacementYear: number;
    estimatedCostChf: number;
    deductiblePct: number;
  }

  const allItems: CapexItem[] = [];
  let totalReplacementValueChf = 0; // FCI denominator
  let currentOverdueChf = 0;        // FCI numerator (current state)

  for (const asset of buildingAssets) {
    const dep = asset.depreciation;
    if (!dep) continue;

    // Cost estimate — computed for ALL assets (FCI needs the full denominator)
    const costKey = `${asset.type}::${asset.topic}`;
    let estimatedCostChf = costCache.get(costKey);
    if (estimatedCostChf === undefined) {
      const cost = await estimateReplacementCost(prisma, orgId, asset.type as AssetType, asset.topic);
      estimatedCostChf = cost.bestEstimate.medianChf;
      costCache.set(costKey, estimatedCostChf);
    }
    totalReplacementValueChf += estimatedCostChf;

    // Replacement year
    let replacementYear: number;
    if (dep.depreciationPct >= 100) {
      replacementYear = currentYear;
      currentOverdueChf += estimatedCostChf; // Already overdue → FCI current numerator
    } else {
      const remainingMonths = dep.usefulLifeMonths - dep.ageMonths;
      replacementYear = currentYear + Math.max(0, Math.ceil(remainingMonths / 12));
    }

    // Assets beyond the extended horizon don't enter the capex schedule
    if (replacementYear > extendedToYear) continue;

    // Tax classification — only needed for assets entering the schedule
    let deductiblePct = taxCache.get(costKey);
    if (deductiblePct === undefined) {
      const tax = await classifyAsset(
        prisma, asset.type as AssetType, asset.topic, building.canton ?? null,
      );
      deductiblePct = tax.deductiblePct;
      taxCache.set(costKey, deductiblePct);
    }

    allItems.push({
      assetId: asset.id,
      assetName: asset.name,
      topic: asset.topic,
      estimatedReplacementYear: replacementYear,
      estimatedCostChf,
      deductiblePct,
    });
  }

  // ── 5. Build capex and tax-shield maps per scenario ───────────

  // INVEST: bucket items by their scheduled year, capped to toYear
  const investCapex = new Map<number, number>();
  const investTaxShield = new Map<number, number>();
  for (const item of allItems) {
    const y = item.estimatedReplacementYear;
    if (y >= fromYear && y <= toYear) {
      investCapex.set(y, (investCapex.get(y) ?? 0) + item.estimatedCostChf);
      const shield = Math.round(
        item.estimatedCostChf * (item.deductiblePct / 100) * (ownerMarginalTaxRatePct / 100),
      );
      investTaxShield.set(y, (investTaxShield.get(y) ?? 0) + shield);
    }
  }

  // DEFER: push items due in the first `deferYears` window back by deferYears
  const deferCapex = new Map<number, number>();
  const deferTaxShield = new Map<number, number>();
  for (const item of allItems) {
    const originalYear = item.estimatedReplacementYear;
    const deferredYear =
      originalYear < fromYear + deferYears
        ? originalYear + deferYears
        : originalYear;
    if (deferredYear >= fromYear && deferredYear <= toYear) {
      deferCapex.set(deferredYear, (deferCapex.get(deferredYear) ?? 0) + item.estimatedCostChf);
      const shield = Math.round(
        item.estimatedCostChf * (item.deductiblePct / 100) * (ownerMarginalTaxRatePct / 100),
      );
      deferTaxShield.set(deferredYear, (deferTaxShield.get(deferredYear) ?? 0) + shield);
    }
  }

  // NEGLECT: no ongoing capex — no tax shield either.
  // Backlog is charged as a terminal property value deduction (when sale price is known)
  // or as a cash outflow at horizon end (otherwise).
  const capexBacklog = [...investCapex.values()].reduce((s, v) => s + v, 0);
  const neglectCapex = new Map<number, number>();
  if (!terminalValueModeled && capexBacklog > 0) {
    neglectCapex.set(toYear, capexBacklog);
  }

  // ── 6. FCI ─────────────────────────────────────────────────────
  // Current: proportion of total replacement value that is already overdue.
  // Neglect at horizon: all within-horizon capex accumulates as deferred backlog.
  const fciCurrentPct = totalReplacementValueChf > 0
    ? Math.round((currentOverdueChf / totalReplacementValueChf) * 1000) / 10
    : 0;
  const fciNeglectHorizonPct = totalReplacementValueChf > 0
    ? Math.round((capexBacklog / totalReplacementValueChf) * 1000) / 10
    : 0;

  // ── 7. Compute each scenario ───────────────────────────────────
  const invest = buildScenario(
    fromYear, toYear, baseAnnualNoiChf, incomeGrowthRatePct, discountRatePct, investCapex,
    {
      terminalValueChf: terminalValueModeled ? propertyValueChf : undefined,
      taxShieldByYear: investTaxShield,
    },
  );
  const defer = buildScenario(
    fromYear, toYear, baseAnnualNoiChf, incomeGrowthRatePct, discountRatePct, deferCapex,
    {
      terminalValueChf: terminalValueModeled ? propertyValueChf : undefined,
      taxShieldByYear: deferTaxShield,
    },
  );
  const neglect = buildScenario(
    fromYear, toYear, baseAnnualNoiChf, incomeGrowthRatePct, discountRatePct, neglectCapex,
    {
      noiErosionRatePct: neglectNoiErosionRatePct,
      erosionStartOffset: deferYears,
      terminalValueChf: terminalValueModeled
        ? Math.max(0, propertyValueChf! - capexBacklog)
        : undefined,
      // No taxShieldByYear: Neglect performs no consented work
    },
  );

  return {
    buildingId,
    buildingName: building.name,
    discountRatePct,
    incomeGrowthRatePct,
    horizonYears,
    deferYears,
    baseAnnualNoiChf,
    noIncomeData,
    fromYear,
    toYear,
    scenarios: { invest, defer, neglect },
    terminalValueModeled,
    propertyValueChf,
    neglectNoiErosionRatePct,
    ownerMarginalTaxRatePct,
    ownerTaxRateIsDefault,
    fciCurrentPct,
    fciNeglectHorizonPct,
    totalReplacementValueChf,
  };
}

/**
 * Portfolio variant: aggregate NPV across multiple buildings.
 * For a single building, delegates directly to computeNPVScenarios.
 * For multiple buildings, sums DCF flows (linearity of NPV) across buildings.
 */
export async function computeNPVScenariosForBuildings(
  prisma: PrismaClient,
  orgId: string,
  buildingIds: string[],
  options: NPVOptions = {},
): Promise<NPVScenariosResult> {
  if (buildingIds.length === 0) {
    throw Object.assign(new Error("At least one buildingId is required"), { statusCode: 400 });
  }

  // Single building — direct delegation, no aggregation needed
  if (buildingIds.length === 1) {
    return computeNPVScenarios(prisma, orgId, buildingIds[0], options);
  }

  // Portfolio: run per-building, then aggregate
  const results = await Promise.all(
    buildingIds.map((id) => computeNPVScenarios(prisma, orgId, id, options)),
  );

  function sumScenario(key: "invest" | "defer" | "neglect"): NPVScenarioResult {
    const base = results[0].scenarios[key];
    const aggregated: NPVYearlyFlow[] = base.yearlyFlows.map((flow, i) => {
      const pvChf = results.reduce((s, r) => s + (r.scenarios[key].yearlyFlows[i]?.pvChf ?? 0), 0);
      const netCashFlowChf = results.reduce((s, r) => s + (r.scenarios[key].yearlyFlows[i]?.netCashFlowChf ?? 0), 0);
      const projectedNoiChf = results.reduce((s, r) => s + (r.scenarios[key].yearlyFlows[i]?.projectedNoiChf ?? 0), 0);
      const capexChf = results.reduce((s, r) => s + (r.scenarios[key].yearlyFlows[i]?.capexChf ?? 0), 0);
      const taxShieldChf = results.reduce((s, r) => s + (r.scenarios[key].yearlyFlows[i]?.taxShieldChf ?? 0), 0);
      const cumulativePvChf = results.reduce((s, r) => s + (r.scenarios[key].yearlyFlows[i]?.cumulativePvChf ?? 0), 0);
      return { ...flow, pvChf, netCashFlowChf, projectedNoiChf, capexChf, taxShieldChf, cumulativePvChf };
    });
    return {
      npvChf:           results.reduce((s, r) => s + r.scenarios[key].npvChf, 0),
      totalCapexChf:    results.reduce((s, r) => s + r.scenarios[key].totalCapexChf, 0),
      totalTaxShieldChf: results.reduce((s, r) => s + r.scenarios[key].totalTaxShieldChf, 0),
      totalNoiChf:      results.reduce((s, r) => s + r.scenarios[key].totalNoiChf, 0),
      terminalValuePvChf: results.reduce((s, r) => s + r.scenarios[key].terminalValuePvChf, 0),
      yearlyFlows: aggregated,
    };
  }

  const first = results[0];
  return {
    buildingId:   "",
    buildingName: `Portfolio (${results.length} buildings)`,
    discountRatePct:         first.discountRatePct,
    incomeGrowthRatePct:     first.incomeGrowthRatePct,
    horizonYears:            first.horizonYears,
    deferYears:              first.deferYears,
    baseAnnualNoiChf:        results.reduce((s, r) => s + r.baseAnnualNoiChf, 0),
    noIncomeData:            results.every((r) => r.noIncomeData),
    fromYear:                first.fromYear,
    toYear:                  first.toYear,
    scenarios: {
      invest:  sumScenario("invest"),
      defer:   sumScenario("defer"),
      neglect: sumScenario("neglect"),
    },
    terminalValueModeled:    results.some((r) => r.terminalValueModeled),
    propertyValueChf:        results.reduce((s, r) => s + (r.propertyValueChf ?? 0), 0) || undefined,
    neglectNoiErosionRatePct: first.neglectNoiErosionRatePct,
    ownerMarginalTaxRatePct: first.ownerMarginalTaxRatePct,
    ownerTaxRateIsDefault:   results.some((r) => r.ownerTaxRateIsDefault),
    fciCurrentPct:  results.reduce((s, r) => s + r.fciCurrentPct, 0) / results.length,
    fciNeglectHorizonPct: results.reduce((s, r) => s + r.fciNeglectHorizonPct, 0) / results.length,
    totalReplacementValueChf: results.reduce((s, r) => s + r.totalReplacementValueChf, 0),
  };
}
