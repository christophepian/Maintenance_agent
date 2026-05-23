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
 *
 * Layer: service (orchestrates repository + capexProjectionService — no direct Prisma calls
 * beyond the NOI snapshot lookup delegated to the repository).
 */

import { PrismaClient } from "@prisma/client";
import { getCapExProjection } from "./capexProjectionService";
import { getAssetInventoryForBuilding } from "./assetInventory";
import { findAllSnapshotsForBuilding } from "../repositories/buildingFinancialSnapshotRepository";
import { findBuildingByIdAndOrg } from "../repositories/inventoryRepository";

// ─── Public types ──────────────────────────────────────────────

export interface NPVYearlyFlow {
  year: number;
  projectedNoiChf: number;
  capexChf: number;
  netCashFlowChf: number;
  discountFactor: number;
  pvChf: number;
  cumulativePvChf: number;
}

export interface NPVScenarioResult {
  npvChf: number;
  totalCapexChf: number;
  totalNoiChf: number;
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
  /** Temporary diagnostics — remove once root cause is confirmed */
  _diag: {
    totalSnapshotCount: number;
    annualSnapshotCount: number;
    capexItemCount: number;
    capexTotalChf: number;
    noiBasis: "annual_snapshot" | "annualized_history" | "leases" | "zero";
    /** Raw assets for this building — shows actual topic values vs what static table expects */
    assets: Array<{ assetType: string; topic: string; hasDepreciation: boolean; depreciationPct: number | null }>;
  };
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
): NPVScenarioResult {
  const flows: NPVYearlyFlow[] = [];
  let cumulativePvChf = 0;

  for (let year = fromYear; year <= toYear; year++) {
    const yearsAhead = year - fromYear;
    const projectedNoiChf = Math.round(baseAnnualNoiChf * growthFactor(incomeGrowthRatePct, yearsAhead));
    const capexChf = capexByYear.get(year) ?? 0;
    const netCashFlowChf = projectedNoiChf - capexChf;
    const df = discountFactor(discountRatePct, yearsAhead + 1); // convention: first cash flow at end of year 1
    const pvChf = Math.round(netCashFlowChf * df);
    cumulativePvChf += pvChf;

    flows.push({
      year,
      projectedNoiChf,
      capexChf,
      netCashFlowChf,
      discountFactor: Math.round(df * 10000) / 10000,
      pvChf,
      cumulativePvChf,
    });
  }

  const totalNoiChf = flows.reduce((s, f) => s + f.projectedNoiChf, 0);
  const totalCapexChf = flows.reduce((s, f) => s + f.capexChf, 0);
  const npvChf = flows.reduce((s, f) => s + f.pvChf, 0);

  return { npvChf, totalCapexChf, totalNoiChf, yearlyFlows: flows };
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

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear;
  const toYear = currentYear + horizonYears - 1;

  // ── 1. Verify building ─────────────────────────────────────────
  const building = await findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) {
    throw Object.assign(new Error(`Building ${buildingId} not found`), { statusCode: 404 });
  }

  // ── 2. Base annual NOI from most recent full-year snapshot ─────
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
  let noiBasis: "annual_snapshot" | "annualized_history" | "leases" | "zero" = "zero";

  if (annualSnapshots.length > 0) {
    // Best case: a full Jan 1–Dec 31 snapshot from a prior year
    const latest = annualSnapshots[annualSnapshots.length - 1];
    baseAnnualNoiChf = Math.round(Number(latest.netOperatingIncomeCents) / 100);
    noiBasis = "annual_snapshot";
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
        noiBasis = "annualized_history";
      }
    }
  }

  if (baseAnnualNoiChf === 0) {
    // Fallback B: active lease rent as proxy for annual gross income
    const leases = await prisma.lease.findMany({
      where: { orgId, unit: { buildingId }, status: { in: ["ACTIVE", "SIGNED"] } },
      select: { rentTotalChf: true },
    });
    baseAnnualNoiChf = Math.round(
      leases.reduce((s, l) => s + (l.rentTotalChf ?? 0), 0) * 12,
    );
    if (baseAnnualNoiChf > 0) {
      noiBasis = "leases";
    } else {
      noIncomeData = true;
    }
  }

  // ── 3. Capex projection — use extended horizon for defer rebucketing ──
  const extendedHorizon = horizonYears + deferYears;
  const projection = await getCapExProjection(prisma, orgId, { horizonYears: extendedHorizon });
  const buildingProjection = projection.buildings.find((b) => b.buildingId === buildingId);

  // All projected items across the extended horizon for this building
  const allItems = buildingProjection
    ? buildingProjection.yearlyBuckets.flatMap((b) => b.items)
    : [];

  // ── 4. Build capex maps per scenario ─────────────────────────

  // INVEST: bucket items by their scheduled year, capped to toYear
  const investCapex = new Map<number, number>();
  for (const item of allItems) {
    const y = item.estimatedReplacementYear;
    if (y !== null && y >= fromYear && y <= toYear) {
      investCapex.set(y, (investCapex.get(y) ?? 0) + item.estimatedCostChf);
    }
  }

  // DEFER: push items due in the first `deferYears` window back by deferYears
  const deferCapex = new Map<number, number>();
  for (const item of allItems) {
    const originalYear = item.estimatedReplacementYear;
    if (originalYear === null) continue;
    const deferredYear =
      originalYear < fromYear + deferYears
        ? originalYear + deferYears
        : originalYear;
    if (deferredYear >= fromYear && deferredYear <= toYear) {
      deferCapex.set(deferredYear, (deferCapex.get(deferredYear) ?? 0) + item.estimatedCostChf);
    }
  }

  // NEGLECT: no capex at all
  const neglectCapex = new Map<number, number>();

  // ── 5. Compute each scenario ───────────────────────────────────
  const invest = buildScenario(fromYear, toYear, baseAnnualNoiChf, incomeGrowthRatePct, discountRatePct, investCapex);
  const defer = buildScenario(fromYear, toYear, baseAnnualNoiChf, incomeGrowthRatePct, discountRatePct, deferCapex);
  const neglect = buildScenario(fromYear, toYear, baseAnnualNoiChf, incomeGrowthRatePct, discountRatePct, neglectCapex);

  // ── Diagnostics: fetch raw assets to show actual topic values ─
  const rawAssets = await getAssetInventoryForBuilding(prisma, orgId, buildingId, {
    canton: building.canton ?? null,
  });

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
    _diag: {
      totalSnapshotCount: snapshots.length,
      annualSnapshotCount: annualSnapshots.length,
      capexItemCount: allItems.length,
      capexTotalChf: allItems.reduce((s, i) => s + i.estimatedCostChf, 0),
      noiBasis,
      assets: rawAssets.map((a) => ({
        assetType: a.type,
        topic: a.topic,
        hasDepreciation: a.depreciation !== null,
        depreciationPct: a.depreciation?.depreciationPct ?? null,
      })),
    },
  };
}
