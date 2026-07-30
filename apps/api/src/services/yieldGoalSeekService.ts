/**
 * Yield goal-seek — the inverse of the forward NPV/renovation model.
 *
 * Given a target net yield, compute the NOI gap and translate it into each lever's
 * native unit (rent, opex, occupancy, management fee), plus a renovation lever that
 * models the value uplift (ΔV) each renovation adds — so the "reachable via works"
 * verdict is honest rather than optimistic.
 *
 * Pure: the route composes the DB reads (unitProfitability result, renovation
 * opportunities, per-asset tax split) and passes plain numbers here.
 *
 * ── Shared model with the simulator ──────────────────────────────────────────
 * Renovation opportunities carry a COST but no stored rent uplift. The simulator
 * derives uplift from OBLF Art. 14 as `cost × passthrough% / usefulLifeYears`
 * (RenovationSimulatorDrawer). This service uses the SAME formula so the yield it
 * promises equals the figure the simulator shows when the user hands off into it.
 */

/** Fraction of a renovation's capex that adds to intrinsic value (the capitalizable,
 *  i.e. improvement, portion). Falls back to this when no tax rule matches. */
export const DEFAULT_CAPITALIZABLE_FRACTION = 0.65;
/** OBLF Art. 14 default passthrough — must match the simulator's default. */
export const DEFAULT_OBLF_PASSTHROUGH_PCT = 50;

export interface GoalSeekOpportunity {
  assetId: string;
  unitId: string | null;
  /** Display label, e.g. "Bathroom refresh — 2.03". */
  label: string;
  /** Estimated replacement cost (CHF) — the capex. */
  costChf: number;
  /** Useful life in years — the OBLF amortisation period for the uplift. */
  usefulLifeYears: number;
  /** Capitalizable (value-adding) share of the capex, 0..1. */
  capitalizableFraction: number;
}

export interface YieldGoalSeekInput {
  /** Yield-basis value V (intrinsic, else market/PPE) — matches the Profitability tab. */
  valueChf: number;
  /** Current annual NOI (CHF). */
  currentNoiChf: number;
  /** Current annual gross rent roll (CHF). */
  rentRollChf: number;
  /** Current occupancy, 0..1. */
  occupancyRate: number;
  /** Target net yield, as a percentage (e.g. 3.5). */
  targetYieldPct: number;
  /** Current management fee, as a % of rent (drives the fee lever; user-set). */
  mgmtFeePct: number;
  /** OBLF passthrough shared with the simulator (default 50). */
  oblfPassthroughPct?: number;
  opportunities: GoalSeekOpportunity[];
}

export interface RenovationLine {
  assetId: string;
  unitId: string | null;
  label: string;
  costChf: number;
  annualUpliftChf: number;
  deltaValueChf: number;
  /** Marginal yield of the works = annualUplift / ΔV. */
  marginalYieldPct: number;
  /** True when marginal yield beats the current yield (raises the ratio). */
  accretive: boolean;
}

export interface YieldGoalSeekResult {
  currentYieldPct: number;
  targetYieldPct: number;
  valueChf: number;
  currentNoiChf: number;
  /** Annual gross rent roll — lets the client recompute rent/fee levers live. */
  rentRollChf: number;
  /** Building occupancy 0..1 — lets the client recompute the occupancy lever live. */
  occupancyRate: number;
  requiredNoiChf: number;
  gapChf: number;
  /** Target already met (gap ≤ 0). */
  met: boolean;
  levers: {
    rent: { deltaMonthlyChf: number; pctOfRentRoll: number };
    opex: { requiredReductionChf: number };
    occupancy: { requiredOccupancyRate: number; feasible: boolean };
    mgmtFee: { feeChf: number; ppOfYield: number; gapCoverPct: number };
    renovation: {
      lines: RenovationLine[];
      accretiveCount: number;
      /** Yield if every accretive work is done (with ΔV in the denominator). */
      ceilingYieldPct: number;
      /** True when the accretive works alone reach the target. */
      feasible: boolean;
      capexChf: number;
      annualUpliftChf: number;
      deltaValueChf: number;
    };
  };
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Annual rent uplift from a renovation, OBLF Art. 14 — SHARED with the simulator. */
export function oblfAnnualUplift(costChf: number, usefulLifeYears: number, passthroughPct: number): number {
  if (usefulLifeYears <= 0) return 0;
  return (costChf * (passthroughPct / 100)) / usefulLifeYears;
}

export function computeYieldGoalSeek(input: YieldGoalSeekInput): YieldGoalSeekResult {
  const {
    valueChf, currentNoiChf, rentRollChf, occupancyRate,
    targetYieldPct, mgmtFeePct,
    oblfPassthroughPct = DEFAULT_OBLF_PASSTHROUGH_PCT,
    opportunities,
  } = input;

  const currentYield = valueChf > 0 ? currentNoiChf / valueChf : 0;
  const target = targetYieldPct / 100;
  const requiredNoi = target * valueChf;
  const gap = requiredNoi - currentNoiChf;
  const met = gap <= 0;

  // Potential rent at full occupancy — the base for the occupancy lever.
  const potentialRent = occupancyRate > 0 ? rentRollChf / occupancyRate : rentRollChf;

  // ── Rent ──
  const rent = {
    deltaMonthlyChf: round(gap / 12),
    pctOfRentRoll: rentRollChf > 0 ? round(gap / rentRollChf, 4) : 0,
  };

  // ── Opex (generic) ──
  const opex = { requiredReductionChf: round(gap) };

  // ── Occupancy ──
  const requiredOccupancyRate = potentialRent > 0 ? occupancyRate + gap / potentialRent : 1;
  const occupancy = {
    requiredOccupancyRate: round(requiredOccupancyRate, 4),
    feasible: requiredOccupancyRate <= 1,
  };

  // ── Management fee (pure simulation — user sets the fee, draws their own read) ──
  const feeChf = (mgmtFeePct / 100) * rentRollChf;
  const mgmtFee = {
    feeChf: round(feeChf),
    ppOfYield: valueChf > 0 ? round((feeChf / valueChf) * 100, 3) : 0,
    gapCoverPct: gap > 0 ? round(Math.min(feeChf, gap) / gap, 4) : 0,
  };

  // ── Renovation, with ΔV ──
  const lines: RenovationLine[] = opportunities.map((o) => {
    const annualUplift = oblfAnnualUplift(o.costChf, o.usefulLifeYears, oblfPassthroughPct);
    const deltaValue = o.costChf * o.capitalizableFraction;
    const marginal = deltaValue > 0 ? annualUplift / deltaValue : 0;
    return {
      assetId: o.assetId,
      unitId: o.unitId,
      label: o.label,
      costChf: round(o.costChf),
      annualUpliftChf: round(annualUplift),
      deltaValueChf: round(deltaValue),
      marginalYieldPct: round(marginal * 100),
      // A work raises the ratio only when its marginal yield beats today's yield.
      accretive: marginal > currentYield,
    };
  });

  const accretive = lines.filter((l) => l.accretive);
  const capex = accretive.reduce((s, l) => s + l.costChf, 0);
  const uplift = accretive.reduce((s, l) => s + l.annualUpliftChf, 0);
  const deltaValue = accretive.reduce((s, l) => s + l.deltaValueChf, 0);
  const ceilingYield = valueChf + deltaValue > 0 ? (currentNoiChf + uplift) / (valueChf + deltaValue) : currentYield;

  const renovation = {
    lines,
    accretiveCount: accretive.length,
    ceilingYieldPct: round(ceilingYield * 100),
    feasible: ceilingYield >= target - 1e-9,
    capexChf: round(capex),
    annualUpliftChf: round(uplift),
    deltaValueChf: round(deltaValue),
  };

  return {
    currentYieldPct: round(currentYield * 100),
    targetYieldPct,
    valueChf: round(valueChf),
    currentNoiChf: round(currentNoiChf),
    rentRollChf: round(rentRollChf),
    occupancyRate: round(occupancyRate, 4),
    requiredNoiChf: round(requiredNoi),
    gapChf: round(gap),
    met,
    levers: { rent, opex, occupancy, mgmtFee, renovation },
  };
}
