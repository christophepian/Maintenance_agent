/**
 * Shared post-login routing — single source of truth for "where does this
 * user land after authenticating".
 *
 * Historically the ROLE_HOME map and the landing-path precedence were
 * duplicated across login.js, api/auth/callback.js and set-password.js (and
 * drifted — e.g. TENANT pointed at /tenant/leases in one and /tenant/inbox in
 * another). This module unifies them and adds the first-login onboarding gate.
 *
 * Isomorphic: plain JS, safe to import from both client pages and the
 * server-side callback handler. NEXT_PUBLIC_SANDBOX is inlined at build time
 * so process.env reads work on both sides.
 */

export const ROLE_HOME = {
  MANAGER: "/manager",
  CONTRACTOR: "/contractor",
  OWNER: "/owner",
  TENANT: "/tenant/leases",
};

// Roles that are taken through the first-login onboarding wizard.
// Tenants authenticate by phone (no wizard); contractors come in via an
// engagement; DOCS_INVESTOR never reaches the app.
const ONBOARDING_ROLES = ["OWNER", "MANAGER"];

function isSandbox() {
  return process.env.NEXT_PUBLIC_SANDBOX === "true";
}

/**
 * Should this user be sent through the onboarding wizard?
 *
 * Fires when onboarding hasn't been completed/skipped AND the user is either a
 * brand-new self-service signup (no appRole yet → must pick one) or an
 * owner/manager. Never fires in sandbox, for DOCS_INVESTOR, or for tenants.
 */
export function needsOnboarding({ appMeta = {}, userMeta = {} } = {}) {
  if (isSandbox()) return false;
  if (appMeta.accessLevel === "DOCS_INVESTOR") return false;
  if (appMeta.appRole === "TENANT" || appMeta.appRole === "CONTRACTOR") return false;
  if (userMeta.hasCompletedOnboarding || userMeta.onboardingSkipped) return false;
  if (!appMeta.appRole) return true; // new self-service signup — must choose a role
  return ONBOARDING_ROLES.includes(appMeta.appRole);
}

/**
 * Resolve the destination AFTER the password gate has been satisfied.
 *
 * Precedence:
 *   1. onboarding wizard (if needed) — carries ?next= so we can resume the
 *      originally-requested deep link once onboarding finishes
 *   2. DOCS_INVESTOR → pitchdeck (middleware also locks them here)
 *   3. explicit ?next= deep link
 *   4. role home
 *   5. ADMIN / fallback → /manager
 */
export function resolveLandingPath({ appMeta = {}, userMeta = {}, next = null } = {}) {
  const safeNext = typeof next === "string" && next.startsWith("/") ? next : null;

  if (needsOnboarding({ appMeta, userMeta })) {
    return safeNext ? `/onboarding?next=${encodeURIComponent(safeNext)}` : "/onboarding";
  }

  if (appMeta.accessLevel === "DOCS_INVESTOR") return "/docs/pitchdeck.html";
  if (safeNext) return safeNext;
  if (appMeta.appRole && ROLE_HOME[appMeta.appRole]) return ROLE_HOME[appMeta.appRole];
  if (appMeta.accessLevel === "ADMIN") return "/manager";
  return "/manager";
}
