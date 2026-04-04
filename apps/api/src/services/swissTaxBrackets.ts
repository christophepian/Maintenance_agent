/**
 * Swiss Progressive Tax Bracket Calculator
 *
 * Contains official bracket tables for:
 *   - Federal direct tax (DBSt) 2026  — all cantons
 *   - Canton of Zurich (ZH) 2026      — basic tax × multipliers
 *   - Canton of Geneva (GE) 2025       — basic tax × communal multiplier
 *
 * For cantons without explicit bracket data, falls back to a flat-rate
 * estimate using the owner's configured marginalTaxRate (or 25% default).
 *
 * Sources: PwC Tax Summaries — Switzerland Individual Taxes (2026/2025)
 */

// ─── Types ─────────────────────────────────────────────────────

interface TaxBracket {
  /** Lower bound (inclusive), CHF */
  from: number;
  /** Upper bound (exclusive), CHF — Infinity for the top bracket */
  to: number;
  /** Marginal rate for this bracket, as a percentage (e.g. 13.2 = 13.2%) */
  rate: number;
}

export interface TaxComputationResult {
  /** Total tax on the given income (federal + cantonal/communal) */
  totalTaxChf: number;
  /** Federal portion */
  federalTaxChf: number;
  /** Cantonal/communal portion */
  cantonalTaxChf: number;
  /** Effective (blended) rate = totalTax / income × 100 */
  effectiveRatePct: number;
  /** Marginal rate at this income level (top bracket hit) */
  marginalRatePct: number;
  /** Source description for the UI */
  source: string;
}

// ─── Federal Direct Tax (DBSt) 2026 — Single ──────────────────

const FEDERAL_BRACKETS_SINGLE: TaxBracket[] = [
  { from: 0,       to: 18_500,   rate: 0 },
  { from: 18_500,  to: 33_200,   rate: 0.77 },
  { from: 33_200,  to: 43_500,   rate: 0.88 },
  { from: 43_500,  to: 58_000,   rate: 2.64 },
  { from: 58_000,  to: 76_100,   rate: 2.97 },
  { from: 76_100,  to: 82_000,   rate: 5.94 },
  { from: 82_000,  to: 108_800,  rate: 6.60 },
  { from: 108_800, to: 141_500,  rate: 8.80 },
  { from: 141_500, to: 184_900,  rate: 11.00 },
  { from: 184_900, to: 793_400,  rate: 13.20 },
  { from: 793_400, to: Infinity, rate: 11.50 },
];

// ─── Canton of Zurich (ZH) 2026 — Single basic tax ────────────
// Cantonal factor: × 0.95 (Staatssteuerfuss 2026)
// City of Zurich municipal factor: × 1.19

const ZH_BRACKETS_SINGLE: TaxBracket[] = [
  { from: 0,       to: 7_000,    rate: 0 },
  { from: 7_000,   to: 12_000,   rate: 2 },
  { from: 12_000,  to: 16_800,   rate: 3 },
  { from: 16_800,  to: 24_800,   rate: 4 },
  { from: 24_800,  to: 34_500,   rate: 5 },
  { from: 34_500,  to: 45_700,   rate: 6 },
  { from: 45_700,  to: 58_800,   rate: 7 },
  { from: 58_800,  to: 76_400,   rate: 8 },
  { from: 76_400,  to: 110_400,  rate: 9 },
  { from: 110_400, to: 144_100,  rate: 10 },
  { from: 144_100, to: 197_400,  rate: 11 },
  { from: 197_400, to: 266_700,  rate: 12 },
  { from: 266_700, to: Infinity, rate: 13 },
];

/** ZH: basic tax × cantonal Staatssteuerfuss × municipal factor (City of Zurich) */
const ZH_CANTONAL_MULTIPLIER = 0.95;
const ZH_MUNICIPAL_MULTIPLIER = 1.19;

// ─── Canton of Geneva (GE) 2025 — Single basic tax ────────────
// Communal supplement for City of Geneva: 45.5% of basic cantonal tax

const GE_BRACKETS_SINGLE: TaxBracket[] = [
  { from: 0,       to: 17_493,   rate: 0 },
  { from: 17_493,  to: 21_826,   rate: 8 },
  { from: 21_826,  to: 24_591,   rate: 9 },
  { from: 24_591,  to: 27_356,   rate: 10 },
  { from: 27_356,  to: 30_538,   rate: 11 },
  { from: 30_538,  to: 34_776,   rate: 12 },
  { from: 34_776,  to: 40_497,   rate: 13 },
  { from: 40_497,  to: 46_218,   rate: 14 },
  { from: 46_218,  to: 72_524,   rate: 14.5 },
  { from: 72_524,  to: 120_309,  rate: 15 },
  { from: 120_309, to: 162_806,  rate: 15.5 },
  { from: 162_806, to: 183_258,  rate: 16 },
  { from: 183_258, to: 305_843,  rate: 17 },
  { from: 305_843, to: 609_349,  rate: 17.5 },
  { from: 609_349, to: Infinity, rate: 18 },
];

/** GE: basic cantonal tax × (1 + communal supplement %) — City of Geneva */
const GE_COMMUNAL_MULTIPLIER = 1.455;

// ─── Bracket computation ──────────────────────────────────────

/**
 * Compute progressive tax for the given income using the supplied bracket table.
 * Returns the raw tax amount (before any multipliers).
 */
function computeBracketTax(income: number, brackets: TaxBracket[]): number {
  if (income <= 0) return 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.from) break;
    const taxableInBracket = Math.min(income, bracket.to) - bracket.from;
    tax += taxableInBracket * bracket.rate / 100;
  }
  return Math.round(tax * 100) / 100;
}

/**
 * Get the marginal rate at a given income level for the given bracket table.
 */
function getMarginalRate(income: number, brackets: TaxBracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].from) return brackets[i].rate;
  }
  return 0;
}

// ─── Canton-aware tax computation ─────────────────────────────

/** Cantons with full progressive bracket data */
const SUPPORTED_CANTONS = new Set(["ZH", "GE"]);

/**
 * Check if a canton has progressive bracket data.
 */
export function hasCantonBrackets(canton: string | null): boolean {
  return canton != null && SUPPORTED_CANTONS.has(canton.toUpperCase());
}

/**
 * Compute combined federal + cantonal tax for the given taxable income.
 *
 * - For ZH and GE: uses real progressive brackets.
 * - For other cantons / null: uses flat rate (fallback).
 *
 * @param incomeChf  Annual taxable income in CHF
 * @param canton     Two-letter canton code (e.g. "ZH", "GE"), or null
 * @param flatRatePct Fallback flat rate (owner's configured rate or 25% default)
 */
export function computeSwissTax(
  incomeChf: number,
  canton: string | null,
  flatRatePct: number,
): TaxComputationResult {
  if (incomeChf <= 0) {
    return {
      totalTaxChf: 0,
      federalTaxChf: 0,
      cantonalTaxChf: 0,
      effectiveRatePct: 0,
      marginalRatePct: 0,
      source: "no income",
    };
  }

  // Federal tax (applies to all cantons)
  const federalTax = computeBracketTax(incomeChf, FEDERAL_BRACKETS_SINGLE);
  const federalMarginal = getMarginalRate(incomeChf, FEDERAL_BRACKETS_SINGLE);

  const cantonUpper = canton?.toUpperCase() ?? "";

  if (cantonUpper === "ZH") {
    const basicTax = computeBracketTax(incomeChf, ZH_BRACKETS_SINGLE);
    const cantonalTax = basicTax * ZH_CANTONAL_MULTIPLIER * ZH_MUNICIPAL_MULTIPLIER;
    const cantonalMarginal = getMarginalRate(incomeChf, ZH_BRACKETS_SINGLE);
    const totalTax = Math.round((federalTax + cantonalTax) * 100) / 100;
    const effectiveMarginal = federalMarginal + cantonalMarginal * ZH_CANTONAL_MULTIPLIER * ZH_MUNICIPAL_MULTIPLIER;

    return {
      totalTaxChf: totalTax,
      federalTaxChf: Math.round(federalTax * 100) / 100,
      cantonalTaxChf: Math.round(cantonalTax * 100) / 100,
      effectiveRatePct: Math.round(totalTax / incomeChf * 10000) / 100,
      marginalRatePct: Math.round(effectiveMarginal * 100) / 100,
      source: "Federal 2026 + ZH 2026 brackets",
    };
  }

  if (cantonUpper === "GE") {
    const basicTax = computeBracketTax(incomeChf, GE_BRACKETS_SINGLE);
    const cantonalTax = basicTax * GE_COMMUNAL_MULTIPLIER;
    const cantonalMarginal = getMarginalRate(incomeChf, GE_BRACKETS_SINGLE);
    const totalTax = Math.round((federalTax + cantonalTax) * 100) / 100;
    const effectiveMarginal = federalMarginal + cantonalMarginal * GE_COMMUNAL_MULTIPLIER;

    return {
      totalTaxChf: totalTax,
      federalTaxChf: Math.round(federalTax * 100) / 100,
      cantonalTaxChf: Math.round(cantonalTax * 100) / 100,
      effectiveRatePct: Math.round(totalTax / incomeChf * 10000) / 100,
      marginalRatePct: Math.round(effectiveMarginal * 100) / 100,
      source: "Federal 2026 + GE 2025 brackets",
    };
  }

  // ─── Flat-rate fallback for unsupported cantons ────────────────
  // Without cantonal bracket data we cannot model progressive cantonal
  // taxation.  Use the owner's configured marginal rate as a flat rate.
  // The timing-pair comparison in capexProjectionService handles
  // income-sensitive adjustments separately.
  const totalTax = Math.round(incomeChf * flatRatePct / 100 * 100) / 100;
  const cantonLabel = canton ? ` (${canton})` : "";

  return {
    totalTaxChf: totalTax,
    federalTaxChf: Math.round(federalTax * 100) / 100,
    cantonalTaxChf: Math.round((totalTax - federalTax) * 100) / 100,
    effectiveRatePct: flatRatePct,
    marginalRatePct: flatRatePct,
    source: `Flat rate${cantonLabel}`,
  };
}

/**
 * Compute the tax saving on a deductible amount by comparing
 * tax at (income) vs tax at (income - deduction).
 *
 * This gives the actual CHF saved when a deductible expense reduces
 * taxable income — capturing bracket effects properly.
 */
export interface DeductionSavingResult {
  /** CHF saved by claiming this deduction */
  savingChf: number;
  /** Effective saving rate = savingChf / deductibleAmount × 100 */
  effectiveSavingRatePct: number;
  /** Combined marginal rate at this income level (federal + cantonal) */
  marginalRatePct: number;
  /** Overall effective tax rate at this income level */
  effectiveRatePct: number;
  /** Source description */
  source: string;
}

export function computeDeductionSaving(
  incomeChf: number,
  deductibleAmountChf: number,
  canton: string | null,
  flatRatePct: number,
): DeductionSavingResult {
  const taxBefore = computeSwissTax(incomeChf, canton, flatRatePct);
  const taxAfter = computeSwissTax(
    Math.max(0, incomeChf - deductibleAmountChf),
    canton,
    flatRatePct,
  );
  const saving = Math.round((taxBefore.totalTaxChf - taxAfter.totalTaxChf) * 100) / 100;
  const effectiveSavingRate = deductibleAmountChf > 0
    ? Math.round(saving / deductibleAmountChf * 10000) / 100
    : 0;

  return {
    savingChf: saving,
    effectiveSavingRatePct: effectiveSavingRate,
    marginalRatePct: taxBefore.marginalRatePct,
    effectiveRatePct: taxBefore.effectiveRatePct,
    source: taxBefore.source,
  };
}

// ─── Timing-pair comparison ───────────────────────────────────

export interface TimingPairResult {
  scheduledSavingChf: number;
  recommendedSavingChf: number;
  scheduledMarginalPct: number;
  recommendedMarginalPct: number;
  source: string;
}

/**
 * Compare the tax saving of a deduction in two different income years.
 *
 * For cantons WITH bracket data (ZH, GE): uses full progressive
 * computation for both years — produces real income-sensitive deltas.
 *
 * For cantons WITHOUT bracket data: uses federal brackets for the
 * income-sensitive portion and a FIXED cantonal estimate for both
 * years.  The cantonal rate is locked to the average of the two
 * federal marginal rates so it doesn't auto-compensate for bracket
 * differences.  This lets the federal component create real deltas.
 */
export function computeTimingPairSavings(
  incomeScheduled: number,
  incomeRecommended: number,
  deductibleAmountChf: number,
  canton: string | null,
  flatRatePct: number,
): TimingPairResult {
  // For cantons with full bracket data, use the real computation
  if (hasCantonBrackets(canton)) {
    const sSav = computeDeductionSaving(incomeScheduled, deductibleAmountChf, canton, flatRatePct);
    const rSav = computeDeductionSaving(incomeRecommended, deductibleAmountChf, canton, flatRatePct);
    return {
      scheduledSavingChf: sSav.savingChf,
      recommendedSavingChf: rSav.savingChf,
      scheduledMarginalPct: sSav.marginalRatePct,
      recommendedMarginalPct: rSav.marginalRatePct,
      source: sSav.source,
    };
  }

  // For unsupported cantons: federal brackets + fixed cantonal estimate.
  //
  // The federal saving is computed from real brackets (income-sensitive).
  // The cantonal portion uses a FIXED rate derived from the AVERAGE of
  // the two federal marginals — so it doesn't shift between years.
  //
  // This means:
  //   saving(year) = fedSaving(year) + deduction × fixedCantonalRate
  // The fedSaving differs when incomes are in different brackets.
  // The cantonal portion is the same for both years (by design).

  const fedMargSched = getMarginalRate(incomeScheduled, FEDERAL_BRACKETS_SINGLE);
  const fedMargRec = getMarginalRate(incomeRecommended, FEDERAL_BRACKETS_SINGLE);

  const fedSavingSched = Math.round(
    (computeBracketTax(incomeScheduled, FEDERAL_BRACKETS_SINGLE)
      - computeBracketTax(Math.max(0, incomeScheduled - deductibleAmountChf), FEDERAL_BRACKETS_SINGLE))
    * 100) / 100;

  const fedSavingRec = Math.round(
    (computeBracketTax(incomeRecommended, FEDERAL_BRACKETS_SINGLE)
      - computeBracketTax(Math.max(0, incomeRecommended - deductibleAmountChf), FEDERAL_BRACKETS_SINGLE))
    * 100) / 100;

  // Fixed cantonal estimate: lock to the average federal marginal so
  // the cantonal share stays constant across the two years.
  const avgFedMarginal = (fedMargSched + fedMargRec) / 2;
  const cantonalFixedPct = Math.max(0, flatRatePct - avgFedMarginal);
  const cantonalSaving = Math.round(deductibleAmountChf * cantonalFixedPct / 100 * 100) / 100;

  const cantonLabel = canton ? ` (${canton})` : "";

  return {
    scheduledSavingChf: Math.round(fedSavingSched + cantonalSaving),
    recommendedSavingChf: Math.round(fedSavingRec + cantonalSaving),
    scheduledMarginalPct: Math.round((fedMargSched + cantonalFixedPct) * 100) / 100,
    recommendedMarginalPct: Math.round((fedMargRec + cantonalFixedPct) * 100) / 100,
    source: `Federal 2026 brackets + est. cantonal${cantonLabel}`,
  };
}
