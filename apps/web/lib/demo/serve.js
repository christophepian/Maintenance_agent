/**
 * Demo fixture serving.
 *
 * The public onboarding demo ends on the REAL building page — same components,
 * same layout, no parallel surface to drift — but with no session and no
 * backend behind it. This intercepts the handful of read endpoints that page
 * calls and answers them from a static snapshot instead.
 *
 * The snapshot is not fabricated: `apps/api/scripts/generate-demo-fixtures.ts`
 * runs a régie package through the real ingestion pipeline and records what the
 * reporting services actually returned. This freezes that output.
 *
 * Why this is safe to have in every environment:
 *
 *   - It is keyed on ONE building id (`demo-building`) that is not a UUID and so
 *     can never be a real building's id. Any other path falls straight through
 *     to the normal proxy.
 *   - It only ever RETURNS static JSON. It never calls the backend, never reads
 *     a database, and never sees a token — so it cannot leak anything or be used
 *     to reach real data without auth.
 *   - It answers GET only. A mutating request against the demo building is not
 *     served a fixture; it falls through and fails as it normally would.
 */

import fixtures from "./fixtures.js";
import { DEMO_BUILDING_ID } from "./constants.js";

export { DEMO_BUILDING_ID };

/**
 * Resolve a backend path to a fixture, or null to fall through to the proxy.
 * Query strings are ignored: the demo presents a single reporting period, so
 * every window resolves to the same snapshot.
 */
export function demoFixtureFor(method, path) {
  if (method !== "GET") return null;

  const clean = (path || "").split("?")[0].replace(/\/+$/, "") || "/";

  // The demo building id must appear as a whole path segment. Nothing else is
  // served — in particular no un-scoped route like /financials/portfolio-summary,
  // which would otherwise shadow that endpoint for real, logged-in users. The
  // demo simply goes without the portfolio benchmark (the page already treats it
  // as optional).
  if (!clean.split("/").includes(DEMO_BUILDING_ID)) return null;

  const hit = fixtures.routes[clean];
  if (hit) return hit;

  // A demo-scoped route we didn't snapshot (a tab the demo doesn't cover).
  // Answer with an empty payload rather than falling through to a backend call
  // that would 401 without a session and surface as an error banner.
  return { data: [] };
}

