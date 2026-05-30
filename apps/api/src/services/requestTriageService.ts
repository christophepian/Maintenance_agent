/**
 * Request Triage Service
 *
 * Pure scoring logic — no direct Prisma calls.
 * All DB access goes through contractorRepository (G2).
 *
 * Scoring formula (pure SQL / in-process, no AI in this slice):
 *   score = 0.4 × avgRating/5 + 0.3 × onTimeRate + 0.2 × categoryMatch + 0.1 × buildingMatch
 *
 * Budget hint: P25–P75 of historical PAID invoice amounts for the category.
 * Only returned when ≥2 invoice data points are available.
 */

import { PrismaClient } from "@prisma/client";
import {
  findContractorJobHistories,
  ContractorJobHistory,
} from "../repositories/contractorRepository";

const TOP_N = 3;
const MIN_INVOICE_POINTS_FOR_BUDGET = 2;

export type TriageResult = {
  contractorIds: string[];       // ordered by score, top 3
  budgetMin: number | null;      // CHF cents P25
  budgetMax: number | null;      // CHF cents P75
};

/**
 * Compute triage suggestions for a newly created request.
 *
 * Implements the full fallback matrix:
 * - No jobs in org → { contractorIds: [], budgetMin: null, budgetMax: null }
 * - Contractors exist but none match category → all org contractors, unranked
 * - <3 category matches → return 1–2 ranked
 * - <2 invoice data points → omit budget hint
 */
export async function computeTriage(
  prisma: PrismaClient,
  opts: {
    orgId: string;
    category: string | null | undefined;
    buildingId: string | null | undefined;
  },
): Promise<TriageResult> {
  const { orgId, category, buildingId } = opts;

  const histories = await findContractorJobHistories(
    prisma,
    orgId,
    category,
    buildingId,
  );

  // Fallback: no contractors in org
  if (histories.size === 0) {
    return { contractorIds: [], budgetMin: null, budgetMax: null };
  }

  const scored = scoreContractors(Array.from(histories.values()));
  const topContractors = selectTopContractors(scored);
  const { budgetMin, budgetMax } = computeBudget(
    Array.from(histories.values()),
    category,
  );

  return { contractorIds: topContractors, budgetMin, budgetMax };
}

// ─── Internal helpers ──────────────────────────────────────────

type ScoredContractor = {
  contractorId: string;
  score: number;
  categoryMatch: number;
};

function scoreContractors(histories: ContractorJobHistory[]): ScoredContractor[] {
  return histories.map((h) => {
    // Normalise avgRating to 0–1 (rated on 1–5 scale, 0 = no ratings → treat as 2.5/5)
    const normalizedRating = h.avgRating > 0 ? h.avgRating / 5 : 0.5;
    const score =
      0.4 * normalizedRating +
      0.3 * h.onTimeRate +
      0.2 * h.categoryMatch +
      0.1 * h.buildingMatch;
    return { contractorId: h.contractorId, score, categoryMatch: h.categoryMatch };
  });
}

function selectTopContractors(scored: ScoredContractor[]): string[] {
  const hasAnyMatch = scored.some((s) => s.categoryMatch > 0);

  if (hasAnyMatch) {
    // Sort by score desc, take top N with categoryMatch
    const matched = scored
      .filter((s) => s.categoryMatch > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);
    return matched.map((s) => s.contractorId);
  }

  // No category match: return all contractors unranked (sorted by score still)
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map((s) => s.contractorId);
}

function computeBudget(
  histories: ContractorJobHistory[],
  category: string | null | undefined,
): { budgetMin: number | null; budgetMax: number | null } {
  // Collect all invoice amounts across contractors for the requested category
  const amounts: number[] = histories.flatMap((h) => h.invoiceAmounts);

  if (amounts.length < MIN_INVOICE_POINTS_FOR_BUDGET) {
    return { budgetMin: null, budgetMax: null };
  }

  amounts.sort((a, b) => a - b);
  const p25 = percentile(amounts, 25);
  const p75 = percentile(amounts, 75);

  return { budgetMin: p25, budgetMax: p75 };
}

function percentile(sortedArr: number[], p: number): number {
  const idx = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const frac = idx - lo;
  return Math.round(sortedArr[lo] * (1 - frac) + sortedArr[hi] * frac);
}
