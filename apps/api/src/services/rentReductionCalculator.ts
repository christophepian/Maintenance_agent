/**
 * Rent Reduction Calculator
 *
 * Given matched defects (from defectMatcher) and a lease, computes
 * CHF rent reduction amounts following Swiss tenancy law practice.
 *
 * Business rules:
 *   - Reductions apply to netRentChf only (excluding garage, services, charges)
 *   - Multiple defects: percentages sum but cap at 70% (Swiss judicial practice —
 *     above 70% the tenant typically has grounds for lease termination, not reduction)
 *   - Seasonal defects (heating): only Oct–Apr = 6/12 of the year
 *   - Returns null if no active lease found
 *
 * Part of Legal Engine Hardening Phase B (B-3).
 */

import prisma from "./prismaClient";
import type { DefectMatch } from "./defectMatcher";
import type { DurationInfo } from "./defectClassifier";

// ==========================================
// Public types
// ==========================================

export interface ReductionLine {
  defect: string;
  ruleKey: string;
  reductionPercent: number;
  reductionMax?: number;
  monthlyReductionChf: number;
  monthlyReductionMaxChf?: number;
  seasonal: boolean;
  seasonalNote?: string;
}

export interface RentReductionResult {
  /** Net monthly rent from lease (CHF, in centimes) */
  netRentChf: number;
  /** Best-match (primary) reduction */
  primaryReduction: ReductionLine;
  /** Additional applicable reductions (multi-defect) */
  additionalReductions: ReductionLine[];
  /** Aggregate total (capped) */
  totalReductionPercent: number;
  totalReductionChf: number;
  /** Whether the 70% cap was applied */
  capApplied: boolean;
  capNote?: string;
  /** Duration context if available */
  estimatedBackPayMonths?: number;
}

// ==========================================
// Constants
// ==========================================

/** Swiss judicial practice: max aggregate rent reduction before termination grounds */
const MAX_REDUCTION_PERCENT = 70;

/** Seasonal heating defect categories */
const SEASONAL_CATEGORIES = ["Température"];

/** Heating season months (Oct=10 through Apr=4) — 6 out of 12 */
const SEASONAL_FRACTION = 6 / 12;

// ==========================================
// Main calculation function
// ==========================================

/**
 * Calculate rent reduction amounts for matched defects against a lease.
 *
 * @param matches - Ranked defect matches from matchDefectsToRules()
 * @param leaseId - The active lease ID
 * @param duration - Optional duration info for back-pay estimation
 * @returns RentReductionResult or null if lease not found / no active lease
 */
export async function calculateRentReduction(
  matches: DefectMatch[],
  leaseId: string,
  duration?: DurationInfo | null,
): Promise<RentReductionResult | null> {
  if (!matches.length) return null;

  // Load lease
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      status: true,
      netRentChf: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!lease) return null;

  // Only active/signed leases are eligible
  if (!["ACTIVE", "SIGNED"].includes(lease.status)) return null;

  const netRentChf = lease.netRentChf; // Already in centimes from schema (Int)

  // Build reduction lines
  const lines = matches.map((m) => buildReductionLine(m, netRentChf));

  if (lines.length === 0) return null;

  const primaryReduction = lines[0];
  const additionalReductions = lines.slice(1);

  // Sum percentages and apply cap
  const rawTotalPercent = lines.reduce((sum, l) => sum + l.reductionPercent, 0);
  const capApplied = rawTotalPercent > MAX_REDUCTION_PERCENT;
  const totalReductionPercent = Math.min(rawTotalPercent, MAX_REDUCTION_PERCENT);
  const totalReductionChf = Math.round(netRentChf * totalReductionPercent / 100);

  // Estimate back-pay months if duration is provided
  let estimatedBackPayMonths: number | undefined;
  if (duration?.months && duration.months > 0) {
    estimatedBackPayMonths = duration.months;
  }

  return {
    netRentChf,
    primaryReduction,
    additionalReductions,
    totalReductionPercent,
    totalReductionChf,
    capApplied,
    capNote: capApplied
      ? `Aggregate reduction capped at ${MAX_REDUCTION_PERCENT}%. ` +
        `Above this threshold, Swiss case law typically supports lease termination ` +
        `rather than rent reduction (CO 259b).`
      : undefined,
    estimatedBackPayMonths,
  };
}

/**
 * Calculate rent reduction from a lease ID lookup (finds active lease for a unit).
 *
 * @param matches - Ranked defect matches
 * @param unitId - The unit ID to find an active lease for
 * @param duration - Optional duration info
 * @returns RentReductionResult or null
 */
export async function calculateRentReductionForUnit(
  matches: DefectMatch[],
  unitId: string,
  duration?: DurationInfo | null,
): Promise<RentReductionResult | null> {
  if (!matches.length) return null;

  // Find the most recent active lease for this unit
  const lease = await prisma.lease.findFirst({
    where: {
      unitId,
      status: { in: ["ACTIVE", "SIGNED"] },
    },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });

  if (!lease) return null;

  return calculateRentReduction(matches, lease.id, duration);
}

// ==========================================
// Internal helpers
// ==========================================

function buildReductionLine(match: DefectMatch, netRentChf: number): ReductionLine {
  const seasonal = SEASONAL_CATEGORIES.includes(match.category);

  // Base monthly reduction
  let effectivePercent = match.reductionPercent;
  if (seasonal) {
    // Heating defects apply only during heating season (6 months / year)
    // Annualized: the monthly amount applies Oct–Apr only
    // For monthly budgeting, we show the full-season amount but note it
    effectivePercent = match.reductionPercent; // Keep the per-month rate during season
  }

  const monthlyReductionChf = Math.round(netRentChf * effectivePercent / 100);

  const line: ReductionLine = {
    defect: match.defect,
    ruleKey: match.ruleKey,
    reductionPercent: match.reductionPercent,
    monthlyReductionChf,
    seasonal,
  };

  if (match.reductionMax !== undefined) {
    line.reductionMax = match.reductionMax;
    line.monthlyReductionMaxChf = Math.round(netRentChf * match.reductionMax / 100);
  }

  if (seasonal) {
    line.seasonalNote =
      `Heating defect: reduction applies during heating season (Oct–Apr). ` +
      `Annualized impact: ${Math.round(effectivePercent * SEASONAL_FRACTION)}% of annual rent.`;
  }

  return line;
}
