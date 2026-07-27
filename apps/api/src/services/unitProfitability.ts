/**
 * Profitability — pure allocation + yield math (no Prisma).
 *
 * Building profitability, broken down by unit, for the disposition decision.
 * DIRECT COSTING — a unit's profitability reflects only costs traceable to it:
 *
 *   1. Each unit's NOI = accrued income − expenses booked TO that unit (accrual
 *      basis). No building-level overhead is spread across units.
 *   2. Shared owner opex not booked to any unit (insurance, management, taxes,
 *      shared/exterior maintenance) is surfaced separately as buildingLevelCosts,
 *      never allocated. Reconciliation: Σ unit direct NOI − building-level costs
 *      = building operating NOI.
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
  /** Building operating NOI (income − all operating opex). Shown alongside the sum
   *  of per-unit direct NOIs so the shared building-level costs are explicit. */
  netOperatingIncomeCents: number;
  ppeEstimateChf: number | null;
  marketValueChf: number | null;
  totalDebtChf: number | null;
}

export interface UnitProfitabilityResult {
  rows: UnitProfitabilityRow[];
  totalAnnualNoiCents: number;
  /** Bottom-up building value = Σ unit intrinsic value (CHF), null if none priced. */
  buildingIntrinsicValueChf: number | null;
  /** Building net yield = annual NOI / building value, %. */
  buildingNetYieldPct: number | null;
  /** Which valuation the yield denominator used: intrinsic (bottom-up), else the
   *  stored market value / PPE estimate fallback. Null when no valuation exists. */
  buildingNetYieldBasis: "intrinsic" | "market" | "ppe" | null;
  /** Stored appraisals for reconciliation against the bottom-up value. */
  ppeEstimateChf: number | null;
  marketValueChf: number | null;
  /** Total mortgage balance (CHF) and NAV = bottom-up value − debt. */
  totalDebtChf: number | null;
  navChf: number | null;
  /** Building-level owner opex NOT booked to any unit (insurance, management,
   *  taxes, shared/exterior maintenance), annualised — shown separately, never
   *  spread across units. Units' direct NOI − this = building NOI. */
  buildingLevelCostsCents: number;
  /** Building operating NOI (annualised) — income − all operating opex. */
  buildingOperatingNoiCents: number;
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

  // DIRECT COSTING: a unit's NOI reflects only the expenses booked TO that unit —
  // no building-level overhead is spread across units. The shared owner opex that
  // wasn't booked to any unit is surfaced separately (buildingLevelCostsCents) so
  // there's a clean reconciliation: Σ unit direct NOI − building-level = building NOI.
  const totalArea = inputs.reduce((s, i) => s + (i.val?.livingAreaSqm ?? 0), 0);
  const allocationKey: "livingAreaSqm" | "equal" = totalArea > 0 ? "livingAreaSqm" : "equal";

  const rows: UnitProfitabilityRow[] = inputs.map((i) => {
    const annualNoiCents = Math.round(i.fin.netIncomeCents * annualFactor); // direct: accrued income − unit-booked expenses
    const intrinsicValueChf = intrinsicOf(i.val);
    const annualNoiChf = annualNoiCents / 100;
    return {
      unitId: i.fin.unitId,
      unitNumber: i.fin.unitNumber,
      floor: i.fin.floor,
      tenantName: i.fin.tenantName,
      occupancyRate: i.fin.occupancyRate,
      monthlyRentChf: i.fin.monthlyRentChf,
      allocatedOverheadCents: 0, // direct costing — no per-unit overhead allocation
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
  // Yield denominator: the bottom-up intrinsic value when the units are priced,
  // else fall back to the stored market value / PPE estimate so the building net
  // yield still populates for buildings without a per-unit valuation worksheet.
  // (Per-unit netYieldOnIntrinsicPct stays null when a unit isn't priced.)
  const yieldValueBasisChf =
    buildingIntrinsicValueChf && buildingIntrinsicValueChf > 0 ? buildingIntrinsicValueChf
      : building.marketValueChf && building.marketValueChf > 0 ? building.marketValueChf
        : building.ppeEstimateChf && building.ppeEstimateChf > 0 ? building.ppeEstimateChf
          : null;
  const buildingNetYieldPct =
    yieldValueBasisChf
      ? round2((totalAnnualNoiCents / 100 / yieldValueBasisChf) * 100)
      : null;
  const buildingNetYieldBasis: "intrinsic" | "market" | "ppe" | null =
    !yieldValueBasisChf ? null
      : buildingIntrinsicValueChf && buildingIntrinsicValueChf > 0 ? "intrinsic"
        : building.marketValueChf && building.marketValueChf > 0 ? "market"
          : "ppe";

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

  const buildingOperatingNoiCents = Math.round(building.netOperatingIncomeCents * annualFactor);
  // Shared owner opex not booked to any unit = Σ unit direct NOI − building NOI.
  const buildingLevelCostsCents = Math.max(0, totalAnnualNoiCents - buildingOperatingNoiCents);

  return {
    rows,
    totalAnnualNoiCents,
    buildingIntrinsicValueChf,
    buildingNetYieldPct,
    buildingNetYieldBasis,
    ppeEstimateChf: building.ppeEstimateChf,
    marketValueChf: building.marketValueChf,
    totalDebtChf: building.totalDebtChf,
    navChf,
    buildingLevelCostsCents,
    buildingOperatingNoiCents,
    allocationKey,
  };
}
