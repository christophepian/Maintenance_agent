/**
 * Unit profitability — pure allocation + yield math (no Prisma).
 *
 * Answers "which units are most profitable" for the disposition decision, on a
 * fully-loaded, annualised, yield-on-value basis:
 *
 *   1. Start from each unit's directly-attributed net income (accrual basis).
 *   2. Allocate the building's NON-recoverable, non-unit-attributed operating
 *      overhead (management, common maintenance) across units pro-rata by living
 *      area, so per-unit NOI reflects the true burden. The allocation conserves
 *      the pool exactly (the last unit absorbs the rounding remainder).
 *   3. Annualise to the reporting period.
 *   4. Yield-on-value against BOTH the intrinsic worksheet value and the market
 *      estimate (living area × per-zip price). Rank by market yield — a low market
 *      yield on a high value is the sell/PPE signal; a high yield is a keep.
 *
 * All money in integer cents unless the field name says Chf (valuations are CHF).
 */
import { computeUnitIntrinsicValue, type UnitValuationInputs } from "./unitValuation";

export interface UnitProfitabilityInput {
  /** Per-unit financials from getUnitFinancialSummaries (period, accrual). */
  fin: {
    unitId: string;
    unitNumber: string;
    floor: string | null;
    tenantName: string | null;
    netIncomeCents: number;
    expensesCents: number;
    apportionedChargesCents: number;
    occupancyRate: number;
    monthlyRentChf: number | null;
  };
  /** Valuation worksheet inputs + living area (for value + allocation key). */
  val: (UnitValuationInputs & { livingAreaSqm?: number | null }) | null;
}

export interface UnitProfitabilityRow {
  unitId: string;
  unitNumber: string;
  floor: string | null;
  tenantName: string | null;
  occupancyRate: number;
  monthlyRentChf: number | null;
  /** Pro-rata overhead subtracted this period (transparency). */
  allocatedOverheadCents: number;
  /** Fully-loaded net operating income, annualised. */
  annualNoiCents: number;
  /** Share of the building's total annual NOI, %. */
  noiContributionPct: number | null;
  intrinsicValueChf: number | null;
  marketValueChf: number | null;
  netYieldOnIntrinsicPct: number | null;
  netYieldOnMarketPct: number | null;
  /** True when market yield is materially below the building average (sell/PPE candidate). */
  sellCandidate: boolean;
}

export interface UnitProfitabilityResult {
  rows: UnitProfitabilityRow[];
  totalAnnualNoiCents: number;
  /** Building weighted-average net yield on market value, % (null if no market values). */
  avgNetYieldOnMarketPct: number | null;
  /** The non-recoverable overhead pool allocated across units this period, cents. */
  allocatedOverheadPoolCents: number;
  allocationKey: "livingAreaSqm" | "equal";
  marketPricePerSqmChf: number | null;
}

function intrinsicOf(val: UnitProfitabilityInput["val"]): number | null {
  if (!val || val.intrinsicPricePerSqmChf == null || val.livingAreaSqm == null) return null;
  const v = computeUnitIntrinsicValue(val).intrinsicValueChf;
  return v > 0 ? v : null;
}

function marketOf(val: UnitProfitabilityInput["val"], pricePerSqm: number | null): number | null {
  if (pricePerSqm == null || !val || val.livingAreaSqm == null) return null;
  const v = val.livingAreaSqm * pricePerSqm;
  return v > 0 ? v : null;
}

/** Below this fraction of the building-average market yield → flagged as a sell candidate. */
const SELL_CANDIDATE_FRACTION = 0.75;

export function computeUnitProfitability(
  inputs: UnitProfitabilityInput[],
  building: { operatingTotalCents: number; recoverableAncillaryCents: number },
  marketPricePerSqmChf: number | null,
  periodDays: number,
): UnitProfitabilityResult {
  const annualFactor = periodDays > 0 ? 365 / periodDays : 1;

  // Non-recoverable overhead already attributed to units (exclude recoverable charges).
  const attributedNonRecoverable = inputs.reduce(
    (s, i) => s + (i.fin.expensesCents - i.fin.apportionedChargesCents),
    0,
  );
  const buildingOwnerOpex = building.operatingTotalCents - building.recoverableAncillaryCents;
  const pool = Math.max(0, buildingOwnerOpex - attributedNonRecoverable);

  // Allocation key: living area, else equal.
  const totalArea = inputs.reduce((s, i) => s + (i.val?.livingAreaSqm ?? 0), 0);
  const allocationKey: "livingAreaSqm" | "equal" = totalArea > 0 ? "livingAreaSqm" : "equal";

  // Allocate the pool, conserving the total exactly (last row absorbs the remainder).
  const shares = inputs.map((i) =>
    allocationKey === "livingAreaSqm" ? (i.val?.livingAreaSqm ?? 0) / totalArea : 1 / (inputs.length || 1),
  );
  const allocated: number[] = [];
  let running = 0;
  inputs.forEach((_, idx) => {
    if (idx === inputs.length - 1) {
      allocated.push(pool - running);
    } else {
      const a = Math.round(pool * shares[idx]);
      allocated.push(a);
      running += a;
    }
  });

  const rows: UnitProfitabilityRow[] = inputs.map((i, idx) => {
    const allocatedOverheadCents = inputs.length ? allocated[idx] : 0;
    const fullyLoadedCents = i.fin.netIncomeCents - allocatedOverheadCents;
    const annualNoiCents = Math.round(fullyLoadedCents * annualFactor);
    const intrinsicValueChf = intrinsicOf(i.val);
    const marketValueChf = marketOf(i.val, marketPricePerSqmChf);
    const annualNoiChf = annualNoiCents / 100;
    return {
      unitId: i.fin.unitId,
      unitNumber: i.fin.unitNumber,
      floor: i.fin.floor,
      tenantName: i.fin.tenantName,
      occupancyRate: i.fin.occupancyRate,
      monthlyRentChf: i.fin.monthlyRentChf,
      allocatedOverheadCents,
      annualNoiCents,
      noiContributionPct: null, // filled below once the total is known
      intrinsicValueChf,
      marketValueChf,
      netYieldOnIntrinsicPct: intrinsicValueChf ? round2((annualNoiChf / intrinsicValueChf) * 100) : null,
      netYieldOnMarketPct: marketValueChf ? round2((annualNoiChf / marketValueChf) * 100) : null,
      sellCandidate: false, // filled below
    };
  });

  const totalAnnualNoiCents = rows.reduce((s, r) => s + r.annualNoiCents, 0);
  for (const r of rows) {
    r.noiContributionPct = totalAnnualNoiCents !== 0 ? round2((r.annualNoiCents / totalAnnualNoiCents) * 100) : null;
  }

  // Building weighted-average market yield = ΣNOI(withMarket) / ΣmarketValue.
  const withMarket = rows.filter((r) => r.marketValueChf != null);
  const sumMarketValue = withMarket.reduce((s, r) => s + (r.marketValueChf ?? 0), 0);
  const sumNoiWithMarket = withMarket.reduce((s, r) => s + r.annualNoiCents / 100, 0);
  const avgNetYieldOnMarketPct = sumMarketValue > 0 ? round2((sumNoiWithMarket / sumMarketValue) * 100) : null;

  if (avgNetYieldOnMarketPct != null) {
    const threshold = avgNetYieldOnMarketPct * SELL_CANDIDATE_FRACTION;
    for (const r of rows) {
      r.sellCandidate = r.netYieldOnMarketPct != null && r.netYieldOnMarketPct < threshold;
    }
  }

  // Rank by market yield descending (most profitable first); unpriced units last.
  rows.sort((a, b) => {
    if (a.netYieldOnMarketPct == null && b.netYieldOnMarketPct == null) return 0;
    if (a.netYieldOnMarketPct == null) return 1;
    if (b.netYieldOnMarketPct == null) return -1;
    return b.netYieldOnMarketPct - a.netYieldOnMarketPct;
  });

  return {
    rows,
    totalAnnualNoiCents,
    avgNetYieldOnMarketPct,
    allocatedOverheadPoolCents: pool,
    allocationKey,
    marketPricePerSqmChf,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
