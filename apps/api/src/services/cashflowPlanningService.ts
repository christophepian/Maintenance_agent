/**
 * cashflowPlanningService
 *
 * Computes monthly cashflow buckets for a CashflowPlan.
 *
 * Design decisions:
 * - Baseline CapEx events use the raw depreciation-schedule year (scheduledYear),
 *   NOT the timing advisor's recommendations. Advisor suggestions only enter the
 *   picture when the user explicitly creates a CashflowOverride on the plan.
 * - CapEx events are placed in July of the scheduled year (mid-year assumption).
 * - Historical months pull from BuildingFinancialSnapshot actuals.
 * - Projected income = sum of active/signed lease rentTotalChf × compounded growth.
 * - Projected opex = 3-month trailing average of (expensesTotalCents - capexTotalCents).
 */

import { PrismaClient, LeaseStatus } from "@prisma/client";
import { getCapExProjection, type TimingRecommendation } from "./capexProjectionService";
import type { CashflowPlanWithRelations } from "../repositories/cashflowPlanRepository";

// ─── Public types ──────────────────────────────────────────────

export interface CapexEventItem {
  assetId: string;
  assetName: string;
  estimatedCostCents: number;
  isOverridden: boolean;
  tradeGroup: string;
  bundleId: string | null;
}

export interface MonthlyBucket {
  year: number;
  month: number;           // 1–12
  isActual: boolean;       // true for historical months with snapshot data
  projectedIncomeCents: number;
  projectedOpexCents: number;
  scheduledCapexCents: number;
  netCents: number;
  cumulativeBalanceCents: number;
  capexItems: CapexEventItem[];
}

export interface MonthlyCashflowResult {
  hasOpeningBalance: boolean;
  buckets: MonthlyBucket[];
  /** Timing recommendations from the CapEx advisor, keyed by assetId for easy lookup */
  timingRecommendations: TimingRecommendation[];
}

// ─── Internal helpers ──────────────────────────────────────────

function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function compoundedGrowthFactor(annualRatePct: number, monthsAhead: number): number {
  if (annualRatePct === 0) return 1;
  const annualFactor = 1 + annualRatePct / 100;
  return Math.pow(annualFactor, monthsAhead / 12);
}

// ─── Main computation ──────────────────────────────────────────

export async function computeMonthlyCashflow(
  prisma: PrismaClient,
  plan: CashflowPlanWithRelations,
  orgId: string,
): Promise<MonthlyCashflowResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  // Window: from Jan of prior year (calendar-aligned) + forward to end of horizon
  const windowStart = new Date(currentYear - 1, 0, 1); // Jan 1 of prior year
  const HISTORICAL_MONTHS = (currentYear - (currentYear - 1)) * 12 + (currentMonth - 1);
  // e.g. if currentMonth=4 (April 2026): 12 + 3 = 15 months (Jan 2025 → Mar 2026)

  // ── 1. Fetch historical snapshots ─────────────────────────────
  const buildingIds = plan.buildingId
    ? [plan.buildingId]
    : await prisma.building
        .findMany({ where: { orgId, isActive: true }, select: { id: true } })
        .then((bs) => bs.map((b) => b.id));

  const snapshots = await prisma.buildingFinancialSnapshot.findMany({
    where: {
      orgId,
      buildingId: { in: buildingIds },
      periodStart: { gte: windowStart },
    },
    orderBy: { periodStart: "asc" },
  });

  // Aggregate snapshots by year-month (sum across buildings for portfolio plans)
  const snapshotByMonth = new Map<
    string,
    { earnedIncomeCents: number; opexCents: number; capexCents: number }
  >();

  for (const snap of snapshots) {
    const y = snap.periodStart.getFullYear();
    const m = snap.periodStart.getMonth() + 1;
    const key = yearMonthKey(y, m);
    const existing = snapshotByMonth.get(key) ?? {
      earnedIncomeCents: 0,
      opexCents: 0,
      capexCents: 0,
    };
    snapshotByMonth.set(key, {
      earnedIncomeCents: existing.earnedIncomeCents + snap.earnedIncomeCents,
      opexCents: existing.opexCents + snap.operatingTotalCents,
      capexCents: existing.capexCents + snap.capexTotalCents,
    });
  }

  // ── 2. Trailing 3-month average opex for projected months ─────
  const recentOpexValues: number[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = addMonths(now, -i);
    const key = yearMonthKey(d.getFullYear(), d.getMonth() + 1);
    const snap = snapshotByMonth.get(key);
    if (snap) recentOpexValues.push(snap.opexCents);
  }
  const trailingAvgOpexCents =
    recentOpexValues.length > 0
      ? Math.round(recentOpexValues.reduce((a, b) => a + b, 0) / recentOpexValues.length)
      : 0;

  // ── 3. Projected monthly income base from active leases ───────
  const activeLeases = await prisma.lease.findMany({
    where: {
      orgId,
      status: { in: [LeaseStatus.ACTIVE, LeaseStatus.SIGNED] },
      unit: { buildingId: { in: buildingIds } },
    },
    select: { rentTotalChf: true },
  });

  const baseMonthlyIncomeCents = activeLeases.reduce((sum, l) => {
    const chf = l.rentTotalChf ?? 0;
    return sum + Math.round(chf * 100);
  }, 0);

  // Fallback: if no leases, use 3-month trailing average of earned income
  const recentIncomeValues: number[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = addMonths(now, -i);
    const key = yearMonthKey(d.getFullYear(), d.getMonth() + 1);
    const snap = snapshotByMonth.get(key);
    if (snap) recentIncomeValues.push(snap.earnedIncomeCents);
  }
  const fallbackIncomeCents =
    recentIncomeValues.length > 0
      ? Math.round(recentIncomeValues.reduce((a, b) => a + b, 0) / recentIncomeValues.length)
      : 0;

  const baseProjectedIncomeCents =
    baseMonthlyIncomeCents > 0 ? baseMonthlyIncomeCents : fallbackIncomeCents;

  // ── 4. CapEx projection — baseline (raw scheduledYear) ────────
  const capexProjection = await getCapExProjection(prisma, orgId, {
    horizonYears: Math.ceil(plan.horizonMonths / 12) + 1,
  });

  // Build override map: assetId → overriddenYear
  const overrideMap = new Map<string, number>();
  for (const ov of plan.overrides) {
    overrideMap.set(ov.assetId, ov.overriddenYear);
  }

  // Build bundleId lookup from bundlingAdvice (use yearRange+tradeGroup as key)
  // Map assetId → tradeGroup from the projection items
  const assetTradeGroup = new Map<string, string>();
  const assetBundleId = new Map<string, string | null>();

  for (const bldg of capexProjection.buildings) {
    if (!buildingIds.includes(bldg.buildingId)) continue;

    // Map assets to their trade group from bundlingAdvice
    for (const bundle of bldg.bundlingAdvice) {
      const bundleKey = bundle.yearRange;
      for (const breakdown of bundle.assetBreakdown) {
        // bundlingAdvice.assetBreakdown groups by type+topic, not assetId
        // We'll assign tradeGroup from yearlyBuckets items instead
        void breakdown; // not directly useful for per-asset lookup
      }
      for (const tradeGroup of bundle.tradeGroups) {
        void tradeGroup;
      }
      void bundleKey;
    }

    // Build per-asset trade group from yearlyBuckets items
    for (const bucket of bldg.yearlyBuckets) {
      for (const item of bucket.items) {
        if (!assetTradeGroup.has(item.assetId)) {
          // Derive trade group from topic (simplified: use topic as trade group)
          assetTradeGroup.set(item.assetId, item.topic);
          assetBundleId.set(item.assetId, null);
        }
      }
    }

    // Refine with bundling advice: find which bundle an asset falls into
    for (const bundle of bldg.bundlingAdvice) {
      const [startYearStr, endYearStr] = bundle.yearRange.split("-");
      const startYear = parseInt(startYearStr);
      const endYear = parseInt(endYearStr ?? startYearStr);
      const tradeGroups = bundle.tradeGroups;

      for (const bucket of bldg.yearlyBuckets) {
        if (bucket.year < startYear || bucket.year > endYear) continue;
        for (const item of bucket.items) {
          const topic = item.topic;
          const matchingTrade =
            tradeGroups.find((tg) => topic.toLowerCase().includes(tg.toLowerCase())) ??
            tradeGroups[0];
          if (matchingTrade) {
            assetTradeGroup.set(item.assetId, matchingTrade);
            assetBundleId.set(item.assetId, bundle.yearRange);
          }
        }
      }
    }
  }

  // Collect CapEx events: { assetId, assetName, estimatedCostCents, effectiveYear }
  interface CapexEvent {
    assetId: string;
    assetName: string;
    estimatedCostCents: number;
    effectiveYear: number;
    isOverridden: boolean;
    tradeGroup: string;
    bundleId: string | null;
  }

  const capexEvents: CapexEvent[] = [];

  for (const bldg of capexProjection.buildings) {
    if (!buildingIds.includes(bldg.buildingId)) continue;
    for (const bucket of bldg.yearlyBuckets) {
      for (const item of bucket.items) {
        if (!item.estimatedReplacementYear) continue;
        const originalYear = item.estimatedReplacementYear;
        const overriddenYear = overrideMap.get(item.assetId);
        const effectiveYear = overriddenYear ?? originalYear;

        capexEvents.push({
          assetId: item.assetId,
          assetName: item.assetName,
          estimatedCostCents: Math.round(item.estimatedCostChf * 100),
          effectiveYear,
          isOverridden: overriddenYear !== undefined,
          tradeGroup: assetTradeGroup.get(item.assetId) ?? item.topic,
          bundleId: assetBundleId.get(item.assetId) ?? null,
        });
      }
    }
  }

  // Map CapEx events to year-month (July = mid-year)
  const capexByMonth = new Map<string, CapexEvent[]>();
  for (const ev of capexEvents) {
    const key = yearMonthKey(ev.effectiveYear, 7);
    const existing = capexByMonth.get(key) ?? [];
    existing.push(ev);
    capexByMonth.set(key, existing);
  }

  // ── 5. Build monthly buckets ───────────────────────────────────
  // Forward horizon snapped to end-of-year (December)
  const horizonEndYear = currentYear + Math.ceil(plan.horizonMonths / 12);
  const forwardMonths = (horizonEndYear - currentYear) * 12 + (12 - currentMonth + 1);
  const totalMonths = HISTORICAL_MONTHS + forwardMonths;
  const buckets: MonthlyBucket[] = [];
  let cumulativeBalance = Number(plan.openingBalanceCents ?? 0);
  const hasOpeningBalance = plan.openingBalanceCents !== null;

  for (let i = 0; i < totalMonths; i++) {
    const d = addMonths(windowStart, i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = yearMonthKey(year, month);

    const isPast =
      year < currentYear || (year === currentYear && month < currentMonth);
    const snap = snapshotByMonth.get(key);
    const isActual = isPast && snap !== undefined;

    let projectedIncomeCents: number;
    let projectedOpexCents: number;
    let scheduledCapexCents: number;
    const capexItemsRaw = capexByMonth.get(key) ?? [];

    if (isActual && snap) {
      projectedIncomeCents = snap.earnedIncomeCents;
      projectedOpexCents = snap.opexCents;
      scheduledCapexCents = snap.capexCents;
    } else {
      // Months ahead from now (for growth rate compounding)
      const monthsAhead = i - HISTORICAL_MONTHS;
      const growthFactor = compoundedGrowthFactor(
        plan.incomeGrowthRatePct,
        Math.max(0, monthsAhead),
      );
      projectedIncomeCents = Math.round(baseProjectedIncomeCents * growthFactor);
      projectedOpexCents = trailingAvgOpexCents;
      scheduledCapexCents = capexItemsRaw.reduce(
        (sum, ev) => sum + ev.estimatedCostCents,
        0,
      );
    }

    const netCents = projectedIncomeCents - projectedOpexCents - scheduledCapexCents;
    cumulativeBalance += netCents;

    buckets.push({
      year,
      month,
      isActual,
      projectedIncomeCents,
      projectedOpexCents,
      scheduledCapexCents,
      netCents,
      cumulativeBalanceCents: cumulativeBalance,
      capexItems: capexItemsRaw.map((ev) => ({
        assetId: ev.assetId,
        assetName: ev.assetName,
        estimatedCostCents: ev.estimatedCostCents,
        isOverridden: ev.isOverridden,
        tradeGroup: ev.tradeGroup,
        bundleId: ev.bundleId,
      })),
    });
  }

  // Collect timing recommendations scoped to buildings in this plan
  const timingRecommendations: TimingRecommendation[] = plan.buildingId
    ? capexProjection.timingRecommendations.filter(
        (r) => r.buildingId === plan.buildingId,
      )
    : capexProjection.timingRecommendations;

  return { hasOpeningBalance, buckets, timingRecommendations };
}

// ─── RFP candidates helper ────────────────────────────────────

export interface RfpCandidate {
  groupKey: string;           // stable key: "<earliestYear>-<tradeGroup>"
  tradeGroup: string;
  scheduledYear: number;      // earliest year in the group
  assets: Array<{
    assetId: string;
    assetName: string;
    estimatedCostCents: number;
    isOverridden: boolean;
  }>;
  totalEstimatedCostCents: number;
  suggestedRfpSendDate: string; // ISO date: 3 months before July of scheduledYear
}

export async function computeRfpCandidates(
  prisma: PrismaClient,
  plan: CashflowPlanWithRelations,
  orgId: string,
): Promise<RfpCandidate[]> {
  const buildingIds = plan.buildingId
    ? [plan.buildingId]
    : await prisma.building
        .findMany({ where: { orgId, isActive: true }, select: { id: true } })
        .then((bs) => bs.map((b) => b.id));

  const overrideMap = new Map<string, number>();
  for (const ov of plan.overrides) {
    overrideMap.set(ov.assetId, ov.overriddenYear);
  }

  const capexProjection = await getCapExProjection(prisma, orgId, {
    horizonYears: Math.ceil(plan.horizonMonths / 12) + 1,
  });

  // Group assets by (effectiveYear, tradeGroup)
  const groupMap = new Map<
    string,
    {
      tradeGroup: string;
      scheduledYear: number;
      assets: RfpCandidate["assets"];
    }
  >();

  for (const bldg of capexProjection.buildings) {
    if (!buildingIds.includes(bldg.buildingId)) continue;
    for (const bucket of bldg.yearlyBuckets) {
      for (const item of bucket.items) {
        if (!item.estimatedReplacementYear) continue;
        const originalYear = item.estimatedReplacementYear;
        const effectiveYear = overrideMap.get(item.assetId) ?? originalYear;
        const tradeGroup = item.topic;
        const key = `${effectiveYear}-${tradeGroup}`;

        const existing = groupMap.get(key) ?? {
          tradeGroup,
          scheduledYear: effectiveYear,
          assets: [],
        };
        existing.assets.push({
          assetId: item.assetId,
          assetName: item.assetName,
          estimatedCostCents: Math.round(item.estimatedCostChf * 100),
          isOverridden: overrideMap.has(item.assetId),
        });
        groupMap.set(key, existing);
      }
    }
  }

  const candidates: RfpCandidate[] = [];
  for (const [groupKey, group] of groupMap) {
    const totalEstimatedCostCents = group.assets.reduce(
      (sum, a) => sum + a.estimatedCostCents,
      0,
    );
    // Suggested send date: April 1st of the scheduled year (3 months before July)
    const suggestedRfpSendDate = new Date(group.scheduledYear, 3, 1)
      .toISOString()
      .split("T")[0];

    candidates.push({
      groupKey,
      tradeGroup: group.tradeGroup,
      scheduledYear: group.scheduledYear,
      assets: group.assets,
      totalEstimatedCostCents,
      suggestedRfpSendDate,
    });
  }

  return candidates.sort(
    (a, b) => a.scheduledYear - b.scheduledYear || a.tradeGroup.localeCompare(b.tradeGroup),
  );
}
