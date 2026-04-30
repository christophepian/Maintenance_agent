/**
 * archetypes.js — frontend mirror of apps/api/src/services/strategy/archetypes.ts
 *
 * Single source of user-facing copy for strategy archetypes.
 * Keep in sync with the TypeScript original when adding new archetypes.
 */

export const ARCHETYPE_LABELS = {
  exit_optimizer: "Prepare for sale",
  yield_maximizer: "Maximize income",
  value_builder: "Improve long-term value",
  capital_preserver: "Keep things stable",
  opportunistic_repositioner: "Upgrade and reposition",
};

export const ARCHETYPE_EXPLANATION_COPY = {
  exit_optimizer: {
    explanation:
      "You're preparing this property for sale. We'll prioritise decisions that improve presentation and reduce buyer risk, with a short payback horizon.",
    bullets: [
      "Prioritise fixes that improve presentation and reduce buyer risk",
      "For repair vs. replace decisions, favour lower upfront cost unless the item directly affects sale readiness",
      "Flag compliance issues that could affect a sale transaction",
    ],
    deprioritize:
      "Deprioritize long-term upgrades with payback beyond the expected sale horizon.",
  },
  yield_maximizer: {
    explanation:
      "You want steady, reliable income. We'll favour options that protect cash flow and avoid costly surprises over major upgrade projects.",
    bullets: [
      "Favour reliable, low-disruption maintenance over ambitious upgrades",
      "Protect rental income first — flag anything that risks tenant satisfaction or occupancy",
      "Lean toward predictable spend and flag surprise-risk items in cashflow planning",
    ],
    deprioritize:
      "Deprioritize modernisation projects that disrupt tenants without near-term income impact.",
  },
  value_builder: {
    explanation:
      "You're focused on growing the long-term worth of your property. We'll favour investments that extend asset life and improve quality over quick fixes.",
    bullets: [
      "When an asset fails, lean toward replacement if it's past 60% of its useful life rather than patching it",
      "Flag which investments are worth making now vs. which can wait in cashflow planning",
      "Compliance and energy efficiency upgrades will rank higher in recommendations",
    ],
    deprioritize:
      "Deprioritize short-payback cosmetic fixes in favour of durable investments.",
  },
  capital_preserver: {
    explanation:
      "Stability matters most. We'll recommend low-risk, predictable options that avoid large disruptions or uncertain outcomes.",
    bullets: [
      "Recommend the lowest-risk, most predictable option — repairs over replacements where risk is manageable",
      "Flag any option that introduces cost uncertainty or significant tenant disruption",
      "Flag large renovation projects as low-priority unless compliance requires them",
    ],
    deprioritize:
      "Deprioritize any project that introduces cost uncertainty or tenant disruption, even when the long-term upside is real.",
  },
  opportunistic_repositioner: {
    explanation:
      "You're ready to invest significantly to reposition this property. We'll favour upgrades with strong long-term upside, even if the upfront cost is higher.",
    bullets: [
      "Look for upgrade opportunities, not just like-for-like replacements",
      "Higher upfront cost is acceptable when the long-term value or rental uplift case is strong",
      "Flag modernisation opportunities — energy efficiency, spec upgrades — that align with repositioning",
    ],
    deprioritize:
      "Deprioritize low-impact repairs when a meaningful upgrade option exists.",
  },
};
