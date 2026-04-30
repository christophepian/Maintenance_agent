/**
 * maintenanceDecisionService.ts
 *
 * Blends three signals into a single owner-context-aware maintenance verdict:
 *   1. Repair-vs-replace analysis (depreciation, cumulative costs)
 *   2. Legal obligation level
 *   3. Owner strategy archetype (risk profile dimensions)
 *
 * All functions are PURE — no DB calls. Orchestration lives in the route handler.
 *
 * Algorithm:
 *   a. Derive a "replace bias score" (0–1) from the archetype's weight vector.
 *      High bias → owner prefers investment/modernisation over cheap repair.
 *      Low bias  → owner prefers cash preservation / minimal capex.
 *   b. Start from the base RepairReplace recommendation tier.
 *   c. Apply archetype nudge: ±1 tier when bias is clearly above/below neutral.
 *   d. Apply hard overrides (legal obligation, emergency urgency).
 *   e. Generate rationale bullets and data-source transparency.
 */

import { DECISION_WEIGHTS } from "./strategy/weights";
import type { StrategyArchetype } from "./strategy/archetypes";

// ── Types ──────────────────────────────────────────────────────

export type BaseRecommendation = "REPAIR" | "MONITOR" | "PLAN_REPLACEMENT" | "REPLACE";
export type MaintenanceVerdict  = "REPAIR" | "MONITOR" | "PLAN_REPLACEMENT" | "REPLACE";

export interface RepairReplaceSignal {
  recommendation: BaseRecommendation;
  depreciationPct:            number | null;
  repairToReplacementRatio:   number | null;
  remainingLifeMonths:        number | null;
  breakEvenMonths:            number | null;
  cumulativeRepairCostChf:    number;
  estimatedReplacementCostChf: number | null;
  applianceName?:             string | null;
}

export interface MaintenanceDecisionInput {
  repairReplace:    RepairReplaceSignal | null;
  legalObligation:  "OBLIGATED" | "DISCRETIONARY" | "NOT_APPLICABLE" | null;
  urgency:          string; // LOW | MEDIUM | HIGH | EMERGENCY
  estimatedCostChf: number | null;
  ownerArchetype:   StrategyArchetype | null;
  ownerSecondaryArchetype: StrategyArchetype | null;
  ownerDimensions:  {
    capexTolerance:          number;
    horizon:                 number;
    modernizationPreference: number;
    liquiditySensitivity:    number;
    saleReadiness:           number;
    stabilityPreference:     number;
  } | null;
}

export interface MaintenanceDecisionResult {
  verdict:              MaintenanceVerdict;
  verdictLabel:         string;
  confidence:           "high" | "medium" | "low";
  rationale:            string[];            // 2–4 bullets
  archetypeAlignment:   string | null;       // e.g. "Supports value_builder long-term investment strategy"
  ownerPreferenceNote:  string | null;       // e.g. "Modernisation preference 80/100 — favour replacement"
  archetypeAdjusted:    boolean;             // true if archetype shifted the base recommendation
  baseRecommendation:   BaseRecommendation | null;
  replaceBias:          number | null;       // 0–1, null if no archetype
  dataSources: {
    repairReplaceAvailable:  boolean;
    legalAvailable:          boolean;
    ownerProfileAvailable:   boolean;
    missingDataNote:         string | null;
  };
}

// ── Replace-bias derivation ────────────────────────────────────

/**
 * Compute a 0–1 "replace bias" from an archetype's weight vector.
 * > 0.70  → owner strongly prefers investment (favour REPLACE / UPGRADE)
 * 0.45–0.70 → neutral, keep base decision
 * < 0.45  → owner prefers cash preservation (favour REPAIR / DEFER)
 */
function archetypeReplaceBias(archetype: StrategyArchetype): number {
  const w = DECISION_WEIGHTS[archetype];
  // Weights that tilt toward replacement
  const replaceTilt =
    w.modernizationBenefit * 0.35 +
    w.lifecycleExtension   * 0.35 +
    w.saleAttractiveness   * 0.15 +
    (1 - Math.min(1, w.upfrontCostPenalty)) * 0.15;
  return Math.max(0, Math.min(1, replaceTilt));
}

// ── Tier arithmetic ────────────────────────────────────────────

const TIER_ORDER: BaseRecommendation[] = [
  "REPAIR",
  "MONITOR",
  "PLAN_REPLACEMENT",
  "REPLACE",
];

function tierIndex(t: BaseRecommendation): number {
  return TIER_ORDER.indexOf(t);
}

function tierAtIndex(i: number): BaseRecommendation {
  return TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, i))];
}

// ── Archetype-label helpers ────────────────────────────────────

const ARCHETYPE_LABELS: Record<StrategyArchetype, string> = {
  exit_optimizer:            "Exit Optimizer",
  yield_maximizer:           "Yield Maximizer",
  value_builder:             "Value Builder",
  capital_preserver:         "Capital Preserver",
  opportunistic_repositioner: "Opportunistic Repositioner",
};

const VERDICT_LABELS: Record<MaintenanceVerdict, string> = {
  REPAIR:            "Repair",
  MONITOR:           "Monitor & Repair",
  PLAN_REPLACEMENT:  "Plan Replacement",
  REPLACE:           "Replace Now",
};

// ── Alignment copy ─────────────────────────────────────────────

const ARCHETYPE_INVEST_COPY: Record<StrategyArchetype, string> = {
  exit_optimizer:            "supports a sale-ready asset",
  yield_maximizer:           "minimises disruption and future repair spend",
  value_builder:             "aligns with long-term asset quality strategy",
  capital_preserver:         "extends asset life and reduces replacement risk",
  opportunistic_repositioner: "supports modernisation and income uplift",
};

// ── Main blending function ─────────────────────────────────────

export function blendMaintenanceDecision(
  input: MaintenanceDecisionInput,
): MaintenanceDecisionResult {
  const { repairReplace, legalObligation, urgency, ownerArchetype,
          ownerSecondaryArchetype, ownerDimensions } = input;

  const repairReplaceAvailable = repairReplace !== null;
  const legalAvailable         = legalObligation !== null;
  const ownerProfileAvailable  = ownerArchetype !== null;

  // ── Base recommendation ──────────────────────────────────────
  const base: BaseRecommendation | null = repairReplace?.recommendation ?? null;

  // ── Replace bias from archetype ──────────────────────────────
  let replaceBias: number | null = null;
  let effectiveBias: number | null = null;
  if (ownerArchetype) {
    replaceBias = archetypeReplaceBias(ownerArchetype);
    // Blend with secondary archetype (25% mix, same as weights.ts)
    if (ownerSecondaryArchetype) {
      replaceBias = replaceBias * 0.75 + archetypeReplaceBias(ownerSecondaryArchetype) * 0.25;
    }
    // Further tune from dimension scores if available
    if (ownerDimensions) {
      // modernizationPreference (0–100) can nudge bias ±0.08
      const modNudge = ((ownerDimensions.modernizationPreference - 50) / 50) * 0.08;
      // liquiditySensitivity high → penalise replace (owner dislikes big outflow)
      const liqPenalty = ((ownerDimensions.liquiditySensitivity - 50) / 50) * 0.05;
      replaceBias = Math.max(0, Math.min(1, replaceBias + modNudge - liqPenalty));
    }
    effectiveBias = replaceBias;
  }

  // ── Tier nudge from archetype ────────────────────────────────
  let verdict: MaintenanceVerdict = base ?? "REPAIR";
  let archetypeAdjusted = false;

  if (base && effectiveBias !== null) {
    const baseIdx = tierIndex(base);
    let nudgedIdx = baseIdx;

    if (effectiveBias >= 0.70 && baseIdx < tierIndex("REPLACE")) {
      nudgedIdx = baseIdx + 1; // shift up one tier
    } else if (effectiveBias <= 0.40 && baseIdx > tierIndex("REPAIR") && baseIdx < tierIndex("REPLACE")) {
      // Never downgrade a REPLACE — end-of-life is end-of-life regardless of archetype
      nudgedIdx = baseIdx - 1;
    }

    if (nudgedIdx !== baseIdx) {
      archetypeAdjusted = true;
      verdict = tierAtIndex(nudgedIdx);
    } else {
      verdict = tierAtIndex(baseIdx);
    }
  }

  // ── Hard overrides ────────────────────────────────────────────
  // Legal obligation: cannot defer/ignore
  if (legalObligation === "OBLIGATED" && verdict === "MONITOR") {
    verdict = "PLAN_REPLACEMENT";
    archetypeAdjusted = true;
  }
  // Emergency: no deferral
  if ((urgency === "HIGH" || urgency === "EMERGENCY") && verdict === "MONITOR" && base === "MONITOR") {
    verdict = "REPAIR"; // act now rather than defer
  }

  // ── Confidence ────────────────────────────────────────────────
  const signalCount = [repairReplaceAvailable, legalAvailable, ownerProfileAvailable].filter(Boolean).length;
  const confidence: "high" | "medium" | "low" =
    signalCount === 3 ? "high" :
    signalCount === 2 ? "medium" : "low";

  // ── Rationale bullets ──────────────────────────────────────────
  const rationale: string[] = [];

  if (!repairReplaceAvailable) {
    rationale.push("No asset linked — depreciation and cost data unavailable.");
  } else {
    const rr = repairReplace!;
    if (rr.depreciationPct != null) {
      rationale.push(
        rr.depreciationPct >= 100
          ? `Asset has reached end of useful life (${rr.depreciationPct}% depreciated).`
          : `Asset is ${rr.depreciationPct}% through its useful life${rr.remainingLifeMonths != null ? ` (${Math.round(rr.remainingLifeMonths / 12 * 10) / 10} years remaining)` : ""}.`,
      );
    }
    if (rr.repairToReplacementRatio != null) {
      const pct = Math.round(rr.repairToReplacementRatio * 100);
      rationale.push(
        `Cumulative repair cost is ${pct}% of estimated replacement cost${rr.estimatedReplacementCostChf ? ` (CHF ${rr.estimatedReplacementCostChf.toLocaleString()})` : ""}.`,
      );
    }
    if (rr.breakEvenMonths != null) {
      rationale.push(
        rr.breakEvenMonths === 0
          ? "Repair budget already exceeded — replacing is now cheaper over the horizon."
          : `At current repair rate, break-even with replacement in ${rr.breakEvenMonths} months.`,
      );
    }
  }

  if (legalObligation === "OBLIGATED") {
    rationale.push("Legal obligation — landlord must act; deferral not permissible.");
  } else if (legalObligation === "DISCRETIONARY") {
    rationale.push("Discretionary work — timing at owner's discretion.");
  }

  if (rationale.length === 0) {
    rationale.push("Insufficient data for a full analysis — acting on urgency signal alone.");
  }

  // ── Archetype alignment note ───────────────────────────────────
  let archetypeAlignment: string | null = null;
  let ownerPreferenceNote: string | null = null;

  if (ownerArchetype) {
    const label = ARCHETYPE_LABELS[ownerArchetype];
    const copy  = ARCHETYPE_INVEST_COPY[ownerArchetype];

    if (archetypeAdjusted && effectiveBias !== null) {
      const direction = effectiveBias >= 0.70 ? "upgrading" : "keeping";
      archetypeAlignment = `${label} archetype — ${copy}. Recommendation ${direction === "upgrading" ? "stepped up" : "kept conservative"} to match owner preference.`;
    } else {
      archetypeAlignment = `${label} archetype — ${copy}. Aligns with base assessment.`;
    }

    if (ownerDimensions) {
      const notes: string[] = [];
      if (ownerDimensions.modernizationPreference >= 70) {
        notes.push(`modernisation preference ${ownerDimensions.modernizationPreference}/100`);
      }
      if (ownerDimensions.liquiditySensitivity >= 70) {
        notes.push(`liquidity sensitivity ${ownerDimensions.liquiditySensitivity}/100 (favours repair)`);
      }
      if (ownerDimensions.capexTolerance >= 65) {
        notes.push(`capex tolerance ${ownerDimensions.capexTolerance}/100`);
      }
      if (notes.length > 0) {
        ownerPreferenceNote = `Owner dimensions: ${notes.join(" · ")}.`;
      }
    }
  }

  // ── Missing data note ──────────────────────────────────────────
  const missing: string[] = [];
  if (!repairReplaceAvailable) missing.push("asset depreciation data (no asset linked)");
  if (!legalAvailable)         missing.push("legal obligation classification");
  if (!ownerProfileAvailable)  missing.push("owner risk profile (scored without archetype weighting)");
  const missingDataNote = missing.length > 0
    ? `Missing: ${missing.join("; ")}.`
    : null;

  return {
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    confidence,
    rationale,
    archetypeAlignment,
    ownerPreferenceNote,
    archetypeAdjusted,
    baseRecommendation: base,
    replaceBias,
    dataSources: {
      repairReplaceAvailable,
      legalAvailable,
      ownerProfileAvailable,
      missingDataNote,
    },
  };
}
