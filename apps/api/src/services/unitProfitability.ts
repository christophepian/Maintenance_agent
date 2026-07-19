/**
 * Profitability — pure allocation + yield math (no Prisma).
 *
 * Building profitability, broken down by unit, for the disposition decision:
 *
 *   1. Start from each unit's directly-attributed net income (accrual basis).
 *   2. Allocate the building's NON-recoverable, non-unit-attributed operating
 *      overhead across units pro-rata by living area (conserving the pool exactly).
 *   3. Annualise to the reporting period.
 *   4. Yield-on-value against the unit's valeur intrinsèque (the maintained
 *      worksheet value — always available, no market-price dependency). Rank by
 *      yield; a low yield on a high value is the sell/PPE signal.
 *
 * Building value is computed BOTTOM-UP (Σ unit intrinsic) and reconciled against
 * the stored building appraisals (PPE estimate, market value); NAV = value − debt.
 *
 * All money in integer cents unless the field name says Chf (valuations are CHF).
 */
import { computeUnitIntrinsicValue, type UnitValuationInputs } from "./unitValuation";

export interface UnitProfitabilityInput {
  fin: {
    unitId: string;
    unitNumber: string;
    floor: string | null;
    tenantName: string | null;
    netIncomeCents: number; // direct net (accrual): accrued income − attributed expenses
    expensesCents: number;
    apportionedChargesCents: number;
    occupancyRate: number;
    monthlyRentChf: number | null;
  };
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
  /** Valeur intrinsèque (CHF). */
  intrinsicValueChf: number | null;
  /** This unit's share of the building's intrinsic value, % (feeds the split decision). */
  valueSharePct: number | null;
  netYieldOnIntrinsicPct: number | null;
  /** Yield materially below the building's overall yield → sell/PPE candidate. */
  sellCandidate: boolean;
}

export interface BuildingValuationInput {
  operatingTotalCents: number;
  recoverableAncillaryCents: number;
  ppeEstimateChf: number | null;
  marketValueChf: number | null;
  totalDebtChf: number | null;
}

export interface UnitProfitabilityResult {
  rows: UnitProfitabilityRow[];
  totalAnnualNoiCents: number;
  /** Bottom-up building value = Σ unit intrinsic value (CHF), null if none priced. */
  buildingIntrinsicValueChf: number | null;
  /** Building net yield = annual NOI / bottom-up building value, %. */
  buildingNetYieldPct: number | null;
  /** Stored appraisals for reconciliation against the bottom-up value. */
  ppeEstimateChf: number | null;
  marketValueChf: number | null;
  /** Total mortgage balance (CHF) and NAV = bottom-up value − debt. */
  totalDebtChf: number | null;
  navChf: number | null;
  /** The non-recoverable overhead pool allocated across units this period, cents. */
  allocatedOverheadPoolCents: number;
  allocationKey: "livingAreaSqm" | "equal";
}

function intrinsicOf(val: UnitProfitabilityInput["val"]): number | null {
  if (!val || val.intrinsicPricePerSqmChf == null || val.livingAreaSqm == null) return null;
  const v = computeUnitIntrinsicValue(val).intrinsicValueChf;
  return v > 0 ? v : null;
}

/** Below this fraction of the building's overall yield → flagged as a sell candidate. */
const SELL_CANDIDATE_FRACTION = 0.75;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeUnitProfitability(
  inputs: UnitProfitabilityInput[],
  building: BuildingValuationInput,
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

  const totalArea = inputs.reduce((s, i) => s + (i.val?.livingAreaSqm ?? 0), 0);
  const allocationKey: "livingAreaSqm" | "equal" = totalArea > 0 ? "livingAreaSqm" : "equal";
  const shares = inputs.map((i) =>
    allocationKey === "livingAreaSqm" ? (i.val?.livingAreaSqm ?? 0) / totalArea : 1 / (inputs.length || 1),
  );

  // Allocate the pool, conserving the total exactly (last row absorbs the remainder).
  const allocated: number[] = [];
  let running = 0;
  inputs.forEach((_, idx) => {
    if (idx === inputs.length - 1) allocated.push(pool - running);
    else {
      const a = Math.round(pool * shares[idx]);
      allocated.push(a);
      running += a;
    }
  });

  const rows: UnitProfitabilityRow[] = inputs.map((i, idx) => {
    const allocatedOverheadCents = inputs.length ? allocated[idx] : 0;
    const annualNoiCents = Math.round((i.fin.netIncomeCents - allocatedOverheadCents) * annualFactor);
    const intrinsicValueChf = intrinsicOf(i.val);
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
      noiContributionPct: null,
      intrinsicValueChf,
      valueSharePct: null,
      netYieldOnIntrinsicPct: intrinsicValueChf ? round2((annualNoiChf / intrinsicValueChf) * 100) : null,
      sellCandidate: false,
    };
  });

  const totalAnnualNoiCents = rows.reduce((s, r) => s + r.annualNoiCents, 0);
  const buildingIntrinsicValueChf =
    rows.some((r) => r.intrinsicValueChf != null)
      ? rows.reduce((s, r) => s + (r.intrinsicValueChf ?? 0), 0)
      : null;
  const buildingNetYieldPct =
    buildingIntrinsicValueChf && buildingIntrinsicValueChf > 0
      ? round2((totalAnnualNoiCents / 100 / buildingIntrinsicValueChf) * 100)
      : null;

  for (const r of rows) {
    r.noiContributionPct = totalAnnualNoiCents !== 0 ? round2((r.annualNoiCents / totalAnnualNoiCents) * 100) : null;
    r.valueSharePct =
      buildingIntrinsicValueChf && buildingIntrinsicValueChf > 0 && r.intrinsicValueChf != null
        ? round2((r.intrinsicValueChf / buildingIntrinsicValueChf) * 100)
        : null;
    if (buildingNetYieldPct != null && r.netYieldOnIntrinsicPct != null) {
      r.sellCandidate = r.netYieldOnIntrinsicPct < buildingNetYieldPct * SELL_CANDIDATE_FRACTION;
    }
  }

  const navChf =
    buildingIntrinsicValueChf != null && building.totalDebtChf != null
      ? Math.round(buildingIntrinsicValueChf - building.totalDebtChf)
      : null;

  // Rank by intrinsic yield descending; unpriced units last.
  rows.sort((a, b) => {
    if (a.netYieldOnIntrinsicPct == null && b.netYieldOnIntrinsicPct == null) return 0;
    if (a.netYieldOnIntrinsicPct == null) return 1;
    if (b.netYieldOnIntrinsicPct == null) return -1;
    return b.netYieldOnIntrinsicPct - a.netYieldOnIntrinsicPct;
  });

  return {
    rows,
    totalAnnualNoiCents,
    buildingIntrinsicValueChf,
    buildingNetYieldPct,
    ppeEstimateChf: building.ppeEstimateChf,
    marketValueChf: building.marketValueChf,
    totalDebtChf: building.totalDebtChf,
    navChf,
    allocatedOverheadPoolCents: pool,
    allocationKey,
  };
}
