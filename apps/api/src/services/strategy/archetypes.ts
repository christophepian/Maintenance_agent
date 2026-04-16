/**
 * Strategy archetypes — type definitions and user-facing copy.
 *
 * This file is the single source of truth for archetype labels,
 * explanation paragraphs, "what this means in practice" bullets,
 * and "what we'll deprioritize" sentences.
 *
 * Both the API (explanationService) and the frontend import from
 * this file (or from the api-client re-export). Do NOT hardcode
 * archetype copy in JSX or route handlers.
 *
 * See STRATEGY_ENGINE_SCOPE.md §2.1, §3.5, §4.3.
 */

// ── Archetype enum (matches Prisma enum StrategyArchetype) ─────

export type StrategyArchetype =
  | 'exit_optimizer'
  | 'yield_maximizer'
  | 'value_builder'
  | 'capital_preserver'
  | 'opportunistic_repositioner';

export const STRATEGY_ARCHETYPES: readonly StrategyArchetype[] = [
  'exit_optimizer',
  'yield_maximizer',
  'value_builder',
  'capital_preserver',
  'opportunistic_repositioner',
] as const;

// ── Dimension and score interfaces ─────────────────────────────

export interface StrategyDimensions {
  horizon: number;
  incomePriority: number;
  appreciationPriority: number;
  capexTolerance: number;
  volatilityTolerance: number;
  liquiditySensitivity: number;
  saleReadiness: number;
  stabilityPreference: number;
  modernizationPreference: number;
  disruptionTolerance: number;
}

export interface ArchetypeScores {
  exit_optimizer: number;
  yield_maximizer: number;
  value_builder: number;
  capital_preserver: number;
  opportunistic_repositioner: number;
}

export interface BuildingStrategyOverrides {
  forcePrimaryArchetype?: StrategyArchetype;
  planningHorizonYears?: number;
  capexBudgetConstraint?: number;
  maxTenantDisruption?: 'none' | 'low' | 'medium' | 'high';
  mustMaintainSaleReadiness?: boolean;
}

// ── User-facing labels (§2.1) ──────────────────────────────────

export const ARCHETYPE_LABELS: Record<StrategyArchetype, string> = {
  exit_optimizer: 'Prepare for sale',
  yield_maximizer: 'Maximize income',
  value_builder: 'Improve long-term value',
  capital_preserver: 'Keep things stable',
  opportunistic_repositioner: 'Upgrade and reposition',
};

// ── Explanation copy (§4.3) ────────────────────────────────────

export interface ArchetypeExplanationCopy {
  /** 2–3 sentence plain-language explanation */
  explanation: string;
  /** 3 bullets: "what this means in practice" */
  bullets: [string, string, string];
  /** Single sentence: "what we'll deprioritize" */
  deprioritize: string;
}

export const ARCHETYPE_EXPLANATION_COPY: Record<StrategyArchetype, ArchetypeExplanationCopy> = {
  exit_optimizer: {
    explanation:
      "You're preparing this property for sale. We'll prioritise decisions that improve presentation and reduce buyer risk, with a short payback horizon.",
    bullets: [
      "We'll prioritise fixes that improve presentation and reduce buyer risk",
      "For repair vs. replace decisions, we'll favour lower upfront cost unless the item directly affects sale readiness",
      "We'll highlight compliance issues that could affect a sale transaction",
    ],
    deprioritize:
      "We'll deprioritize long-term upgrades with payback beyond your expected sale horizon.",
  },
  yield_maximizer: {
    explanation:
      "You want steady, reliable income. We'll favour options that protect cash flow and avoid costly surprises over major upgrade projects.",
    bullets: [
      "We'll favour reliable, low-disruption maintenance over ambitious upgrades",
      "Recommendations will protect your rental income first — we'll flag anything that risks tenant satisfaction or occupancy",
      "For cashflow planning, we'll lean toward predictable spend and flag surprise-risk items",
    ],
    deprioritize:
      "We'll deprioritize modernisation projects that disrupt tenants without near-term income impact.",
  },
  value_builder: {
    explanation:
      "You're focused on growing the long-term worth of your property. We'll favour investments that extend asset life and improve quality over quick fixes.",
    bullets: [
      "When an asset fails, we'll lean toward replacement if it's past 60% of its useful life rather than patching it",
      "In cashflow planning, we'll flag which investments are worth making now vs. which can wait",
      "Compliance and energy efficiency upgrades will rank higher in our recommendations",
    ],
    deprioritize:
      "We'll deprioritize short-payback cosmetic fixes in favour of durable investments.",
  },
  capital_preserver: {
    explanation:
      "Stability matters most to you. We'll recommend low-risk, predictable options that avoid large disruptions or uncertain outcomes.",
    bullets: [
      "We'll recommend the lowest-risk, most predictable option — repairs over replacements where the risk is manageable",
      "We'll flag any option that introduces cost uncertainty or significant tenant disruption",
      "Large renovation projects will be flagged as low-priority unless compliance requires them",
    ],
    deprioritize:
      "We'll deprioritize any project that introduces cost uncertainty or tenant disruption, even when the long-term upside is real.",
  },
  opportunistic_repositioner: {
    explanation:
      "You're ready to invest significantly to reposition this property. We'll favour upgrades with strong long-term upside, even if the upfront cost is higher.",
    bullets: [
      "We'll look for upgrade opportunities, not just like-for-like replacements",
      "Higher upfront cost is acceptable when the long-term value or rental uplift case is strong",
      "We'll flag modernisation opportunities — energy efficiency, spec upgrades — that align with repositioning",
    ],
    deprioritize:
      "We'll deprioritize low-impact repairs when a meaningful upgrade option exists.",
  },
};
