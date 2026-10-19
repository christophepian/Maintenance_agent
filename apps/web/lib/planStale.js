// Shared staleness rule for cashflow plans (deduped from CashflowPlansList and
// the plan detail page — CR-023). A plan is stale when its cashflow was last
// computed more than a week ago.

export const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function isPlanStale(plan) {
  if (!plan?.lastComputedAt) return false;
  return Date.now() - new Date(plan.lastComputedAt).getTime() > STALE_THRESHOLD_MS;
}
