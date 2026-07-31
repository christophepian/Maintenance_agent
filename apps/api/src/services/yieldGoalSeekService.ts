/**
 * Yield goal-seek — the inverse of the forward NPV/renovation model.
 *
 * Given a target net yield, compute the NOI gap and translate it into each lever's
 * native unit — but each lever now carries three signals: the number, whether it's
 * REALISTICALLY attainable (feasibility band), and whether it FITS the owner's
 * stated strategy (off-strategy flag). A tiered synthesis reads all of them.
 *
 * Feasibility bands:
 *   rent       — the as-is market gap (from value×gross-yield + vétusté, computed
 *                upstream); realizable on turnover.
 *   opex       — a floor at the best (lowest) non-fee controllable opex of the last
 *                3 years ("you ran it this lean before").
 *   occupancy  — a hard 100% ceiling.
 *   fee        — down to 0, but below ~1% it reframes as self-management.
 *
 * Non-overlap by construction: opex is NON-FEE controllable cost, the fee is its
 * own lever, the rent lever is the market gap (no capex), and renovation is the
 * vétusté-recovery uplift (OBLF, capped at market) — so the synthesis sums them
 * without double-counting. See the planning docs for the fuller rationale.
 *
 * Pure: the route composes the DB reads and passes plain numbers here.
 */

/** Fraction of a renovation's capex that adds to intrinsic value (fallback). */
export const DEFAULT_CAPITALIZABLE_FRACTION = 0.65;
/** OBLF Art. 14 default passthrough — must match the simulator's default. */
export const DEFAULT_OBLF_PASSTHROUGH_PCT = 50;
/** Below this fee %, the fee lever reframes from "cheaper management" to "self-manage". */
export const SELF_MANAGE_FEE_FLOOR_PCT = 1;
/** A rent increase above this share of the roll is "aggressive" (churn risk). */
const AGGRESSIVE_RENT_PCT = 0.04;

export interface GoalSeekOpportunity {
  assetId: string;
  unitId: string | null;
  label: string;
  costChf: number;
  usefulLifeYears: number;
  capitalizableFraction: number;
  /** Cap the OBLF uplift at what the market supports (renovated market − current),
   *  annual CHF. Null = no market data → uncapped OBLF. */
  marketUpliftCeilingAnnualChf?: number | null;
}

/** Which levers run against the owner's stated strategy (from resolveStrategyContext). */
export interface StrategyContext {
  source: "building" | "owner-portfolio" | "none";
  label?: string | null;
  flags: { renovation?: boolean; selfManage?: boolean; rentAggressive?: boolean };
}

export interface YieldGoalSeekInput {
  valueChf: number;
  currentNoiChf: number;
  rentRollChf: number;
  occupancyRate: number;
  targetYieldPct: number;
  mgmtFeePct: number;
  oblfPassthroughPct?: number;
  opportunities: GoalSeekOpportunity[];
  // ── Realism inputs (optional; absent → that band is treated as unbounded) ──
  /** As-is market rent gap (annual CHF, ≥0) — the rent lever's realistic ceiling. */
  rentMarketGapAnnualChf?: number | null;
  /** Avg remaining lease months — for the turnover annotation on the rent lever. */
  avgLeaseRemainingMonths?: number | null;
  /** Current non-fee controllable opex (annual CHF). */
  controllableOpexChf?: number | null;
  /** Best (lowest) non-fee controllable opex over the last 3 years (annual CHF). */
  controllableOpexBest3yrChf?: number | null;
  /** Investor strategy context (drives the off-strategy flags). */
  strategy?: StrategyContext | null;
}

export interface RenovationLine {
  assetId: string;
  unitId: string | null;
  label: string;
  costChf: number;
  annualUpliftChf: number;
  deltaValueChf: number;
  marginalYieldPct: number;
  accretive: boolean;
}

/** Feasible = attainable within the realistic band. offStrategy = against the owner's wishes. */
export interface LeverSignals {
  feasible: boolean;
  offStrategy: boolean;
}

export interface YieldGoalSeekResult {
  currentYieldPct: number;
  targetYieldPct: number;
  valueChf: number;
  currentNoiChf: number;
  rentRollChf: number;
  occupancyRate: number;
  requiredNoiChf: number;
  gapChf: number;
  met: boolean;
  strategySource: StrategyContext["source"];
  /** Raw flags echoed so the client can recompute off-strategy live as it moves the
   *  target/fee (rent/fee off-strategy are target/fee-dependent). Null when no profile. */
  strategyFlags: StrategyContext["flags"] | null;
  strategyLabel: string | null;
  levers: {
    rent: LeverSignals & { deltaMonthlyChf: number; pctOfRentRoll: number; marketGapAnnualChf: number | null; avgLeaseRemainingMonths: number | null };
    opex: LeverSignals & { requiredReductionChf: number; headroomChf: number | null };
    occupancy: LeverSignals & { requiredOccupancyRate: number };
    mgmtFee: LeverSignals & { feeChf: number; ppOfYield: number; gapCoverPct: number; selfManage: boolean };
    renovation: LeverSignals & {
      lines: RenovationLine[];
      accretiveCount: number;
      ceilingYieldPct: number;
      capexChf: number;
      annualUpliftChf: number;
      deltaValueChf: number;
    };
  };
  /** Tiered "realistically reachable" yields — reads both realism and strategy. */
  synthesis: {
    withinStrategyYieldPct: number;
    withRenovationYieldPct: number;
    withSelfManageYieldPct: number;
  };
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Annual rent uplift from a renovation, OBLF Art. 14 — SHARED with the simulator,
 *  then capped at what the market supports (renovated market − current). */
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
    rentMarketGapAnnualChf = null,
    avgLeaseRemainingMonths = null,
    controllableOpexChf = null,
    controllableOpexBest3yrChf = null,
    strategy = null,
  } = input;

  const flags = strategy?.flags ?? {};
  const currentYield = valueChf > 0 ? currentNoiChf / valueChf : 0;
  const target = targetYieldPct / 100;
  const requiredNoi = target * valueChf;
  const gap = requiredNoi - currentNoiChf;
  const met = gap <= 0;
  const potentialRent = occupancyRate > 0 ? rentRollChf / occupancyRate : rentRollChf;

  // ── Rent — realistic ceiling = the as-is market gap (on turnover) ──
  const rentPct = rentRollChf > 0 ? gap / rentRollChf : 0;
  const rent = {
    deltaMonthlyChf: round(gap / 12),
    pctOfRentRoll: round(rentPct, 4),
    marketGapAnnualChf: rentMarketGapAnnualChf != null ? round(rentMarketGapAnnualChf) : null,
    avgLeaseRemainingMonths,
    feasible: rentMarketGapAnnualChf == null ? true : gap <= rentMarketGapAnnualChf + 1e-6,
    offStrategy: !!flags.rentAggressive && rentPct > AGGRESSIVE_RENT_PCT,
  };

  // ── Opex — floor at the best non-fee controllable cost of the last 3 years ──
  const opexHeadroom = controllableOpexChf != null && controllableOpexBest3yrChf != null
    ? Math.max(0, controllableOpexChf - controllableOpexBest3yrChf)
    : null;
  const opex = {
    requiredReductionChf: round(gap),
    headroomChf: opexHeadroom != null ? round(opexHeadroom) : null,
    feasible: opexHeadroom == null ? true : gap <= opexHeadroom + 1e-6,
    offStrategy: false,
  };

  // ── Occupancy — hard 100% ceiling ──
  const requiredOccupancyRate = potentialRent > 0 ? occupancyRate + gap / potentialRent : 1;
  const occupancy = {
    requiredOccupancyRate: round(requiredOccupancyRate, 4),
    feasible: requiredOccupancyRate <= 1,
    offStrategy: false,
  };

  // ── Management fee — down to 0, reframes as self-manage below the floor ──
  const feeChf = (mgmtFeePct / 100) * rentRollChf;
  const selfManage = mgmtFeePct < SELF_MANAGE_FEE_FLOOR_PCT;
  const mgmtFee = {
    feeChf: round(feeChf),
    ppOfYield: valueChf > 0 ? round((feeChf / valueChf) * 100, 3) : 0,
    gapCoverPct: gap > 0 ? round(Math.min(feeChf, gap) / gap, 4) : 0,
    selfManage,
    feasible: true,
    offStrategy: selfManage && !!flags.selfManage,
  };

  // ── Renovation — OBLF uplift capped at market, ΔV in the denominator ──
  const lines: RenovationLine[] = opportunities.map((o) => {
    let annualUplift = oblfAnnualUplift(o.costChf, o.usefulLifeYears, oblfPassthroughPct);
    if (o.marketUpliftCeilingAnnualChf != null) annualUplift = Math.min(annualUplift, Math.max(0, o.marketUpliftCeilingAnnualChf));
    const deltaValue = o.costChf * o.capitalizableFraction;
    const marginal = deltaValue > 0 ? annualUplift / deltaValue : 0;
    return {
      assetId: o.assetId, unitId: o.unitId, label: o.label,
      costChf: round(o.costChf),
      annualUpliftChf: round(annualUplift),
      deltaValueChf: round(deltaValue),
      marginalYieldPct: round(marginal * 100),
      accretive: marginal > currentYield,
    };
  });
  const accretive = lines.filter((l) => l.accretive);
  const renoCapex = accretive.reduce((s, l) => s + l.costChf, 0);
  const renoUplift = accretive.reduce((s, l) => s + l.annualUpliftChf, 0);
  const renoDeltaValue = accretive.reduce((s, l) => s + l.deltaValueChf, 0);
  const ceilingYield = valueChf + renoDeltaValue > 0 ? (currentNoiChf + renoUplift) / (valueChf + renoDeltaValue) : currentYield;
  const renovation = {
    lines,
    accretiveCount: accretive.length,
    ceilingYieldPct: round(ceilingYield * 100),
    feasible: ceilingYield >= target - 1e-9,
    offStrategy: !!flags.renovation,
    capexChf: round(renoCapex),
    annualUpliftChf: round(renoUplift),
    deltaValueChf: round(renoDeltaValue),
  };

  // ── Tiered synthesis (levers are non-overlapping by construction) ──
  const dRentMarket = rentMarketGapAnnualChf ?? 0;                       // on turnover
  const dOpex = opexHeadroom ?? 0;                                       // non-fee
  const dOcc = Math.max(0, (1 - occupancyRate)) * potentialRent;
  const dFeeToFloor = Math.max(0, ((mgmtFeePct - SELF_MANAGE_FEE_FLOOR_PCT) / 100) * rentRollChf);
  const dFeeFull = (mgmtFeePct / 100) * rentRollChf;

  // Within strategy: on-strategy operational levers only.
  const withinDNoi = dOpex + dOcc
    + (rent.offStrategy ? 0 : dRentMarket)
    + (mgmtFee.offStrategy ? 0 : dFeeToFloor);
  const withinYield = valueChf > 0 ? (currentNoiChf + withinDNoi) / valueChf : currentYield;

  // + renovation (accretive works; ΔV grows the denominator).
  const renoDNoi = withinDNoi + renoUplift;
  const renoYield = valueChf + renoDeltaValue > 0 ? (currentNoiChf + renoDNoi) / (valueChf + renoDeltaValue) : withinYield;

  // + self-manage (drop the fee fully to 0 — whatever wasn't already counted).
  const feeExtra = Math.max(0, dFeeFull - (mgmtFee.offStrategy ? 0 : dFeeToFloor));
  const selfDNoi = renoDNoi + feeExtra;
  const selfYield = valueChf + renoDeltaValue > 0 ? (currentNoiChf + selfDNoi) / (valueChf + renoDeltaValue) : renoYield;

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
    strategySource: strategy?.source ?? "none",
    strategyFlags: strategy ? flags : null,
    strategyLabel: strategy?.label ?? null,
    levers: { rent, opex, occupancy, mgmtFee, renovation },
    synthesis: {
      withinStrategyYieldPct: round(withinYield * 100),
      withRenovationYieldPct: round(renoYield * 100),
      withSelfManageYieldPct: round(selfYield * 100),
    },
  };
}
