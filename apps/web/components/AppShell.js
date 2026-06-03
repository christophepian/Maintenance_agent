/**
 * AppShell — main layout wrapper for all persona portals.
 *
 * Auth strategy (post Supabase migration):
 *
 *   Production / staging:
 *     - The edge middleware ensures only authenticated users reach this component.
 *     - On mount we subscribe to supabase.auth.onAuthStateChange to keep
 *       localStorage.authToken (used by fetchWithAuth) in sync with the live
 *       Supabase session. This handles silent token refreshes automatically.
 *     - Role is derived from session.user.app_metadata.appRole and cached in
 *       localStorage.role for immediate availability on page load.
 *
 *   Local development (AUTH_OPTIONAL=true, DEV_IDENTITY_ENABLED=true):
 *     - NEXT_PUBLIC_ROLE_SWITCH_ENABLED=true exposes the role dropdown.
 *     - No Supabase session is required — the backend accepts any request.
 *     - Role is persisted in localStorage.role between page loads.
 *     - The old auto-bootstrap (login with hardcoded dev credentials) has been
 *       removed; AUTH_OPTIONAL=true makes it unnecessary.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import NotificationBell from "./NotificationBell";
import LocaleSwitcher from "./LocaleSwitcher";
import ManagerSidebar from "./ManagerSidebar";
import OwnerSidebar from "./OwnerSidebar";
import ContractorSidebar from "./ContractorSidebar";
import TenantSidebar from "./TenantSidebar";
import BottomNav from "./mobile/BottomNav";
import HubBar from "./HubBar";
import { createClient } from "../lib/supabase/client";
import { setAuthToken } from "../lib/api";

// Role switcher is only shown when explicitly enabled (dev / staging preview).
const ROLE_SWITCH_ENABLED =
  process.env.NEXT_PUBLIC_ROLE_SWITCH_ENABLED === "true";

function getStoredRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role") || null;
}

export default function AppShell({ role: roleProp, children }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [role, setRole] = useState(roleProp || null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── On mount: resolve role + wire Supabase session listener ───────────────
  useEffect(() => {
    // Resolve active role: stored value wins (set by the role switcher),
    // falling back to the page prop, then to nothing.
    // This prevents the page's hardcoded role prop from overwriting an
    // admin's manually-selected role on every navigation.
    const stored = getStoredRole();
    setRole(stored || roleProp || null);

    const supabase = createClient();

    // Read the current session immediately so isAdmin is set on first render,
    // without waiting for onAuthStateChange to fire asynchronously.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthToken(session.access_token);
        const meta = session.user?.app_metadata ?? {};
        setIsAdmin(meta.accessLevel === "ADMIN");
        // Only use appRole as the default when nothing is stored locally.
        // Once the user has switched roles via the switcher, localStorage wins.
        if (!getStoredRole() && meta.appRole) {
          setRole(meta.appRole);
          localStorage.setItem("role", meta.appRole);
        }
        // Persist demo-grant IDs so contractor/tenant pages can read them
        // from localStorage without needing to re-decode the JWT.
        if (meta.contractorId) localStorage.setItem("contractorId", meta.contractorId);
        if (meta.tenantId)     localStorage.setItem("tenantId",     meta.tenantId);
        if (meta.ownerId)      localStorage.setItem("ownerId",      meta.ownerId);

        // Sandbox: auto-provision persona records if setup hasn't run yet.
        // Idempotent — safe to call on every cold session. Fires when contractorId
        // is absent (e.g. SQL-created accounts that bypassed the magic-link flow).
        if (process.env.NEXT_PUBLIC_SANDBOX === "true" && !meta.contractorId) {
          fetch("/api/sandbox/setup", { method: "POST" })
            .then((r) => r.ok && window.location.reload())
            .catch(() => {});
        }
      }
    });

    // Subscribe to Supabase auth state changes to keep the token fresh on
    // silent refreshes. Never overwrite the role — the switcher owns that.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setAuthToken(session.access_token);
          const meta = session.user?.app_metadata ?? {};
          setIsAdmin(meta.accessLevel === "ADMIN");
        } else {
          // Session ended — clear token but keep role in state so the UI
          // doesn't flash. Middleware will redirect on the next navigation.
          setAuthToken(null);
          setIsAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleProp]);

  // ── Role switcher (dev only) ───────────────────────────────────────────────
  function setRoleAndRoute(nextRole) {
    if (typeof window !== "undefined") {
      localStorage.setItem("role", nextRole);
    }
    setRole(nextRole);
    if (nextRole === "CONTRACTOR") {
      router.push("/contractor", undefined, { locale: router.locale });
    } else if (nextRole === "TENANT") {
      router.push("/tenant/leases", undefined, { locale: router.locale });
    } else if (nextRole === "OWNER") {
      router.push("/owner", undefined, { locale: router.locale });
    } else {
      router.push("/manager", undefined, { locale: router.locale });
    }
  }

  // ── Sign-out ───────────────────────────────────────────────────────────────
  async function signOut() {
    const supabase = createClient();
    // scope:'local' clears only this tab's Supabase session without server-side
    // token revocation, so a tenant preview open in another tab is unaffected.
    await supabase.auth.signOut({ scope: "local" });
    setAuthToken(null);
    router.push("/login", undefined, { locale: router.locale });
  }

  const showHubBar = process.env.NEXT_PUBLIC_SANDBOX !== "true" && (isAdmin || role === "MANAGER");

  return (
    <>
      {showHubBar && <HubBar />}
      <div
        className="min-h-screen bg-surface text-foreground font-sans md:grid md:grid-cols-[260px_1fr] md:grid-rows-[1fr] md:h-screen md:overflow-hidden"
        style={showHubBar ? { height: "calc(100vh - 36px)", marginTop: 36 } : undefined}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-10 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg focus:ring-2 focus:ring-blue-500"
        >
          {t("appShell.skipToMainContent")}
        </a>

      <aside
        className="hidden md:flex md:flex-col border-r border-surface-border px-4 py-5 bg-surface-hover"
        aria-label={t("appShell.sidebarNavigation")}
      >
        <div className="font-bold text-lg mb-5">
          {process.env.NEXT_PUBLIC_SANDBOX === "true" ? "Sandbox" : "Sencilo"}
        </div>

        {/* Role switcher — admin users and dev/staging environments */}
        {(ROLE_SWITCH_ENABLED || isAdmin) && (
          <div className="mb-5">
            <div className="text-sm text-muted mb-2">{t("appShell.roleSwitcher")}</div>
            <select
              value={role || "MANAGER"}
              onChange={(e) => setRoleAndRoute(e.target.value)}
              aria-label={t("appShell.switchRole")}
              className="w-full px-2.5 py-2 rounded-lg border border-muted-ring bg-surface-subtle text-foreground cursor-pointer"
            >
              <option value="MANAGER">{t("role.MANAGER")}</option>
              <option value="OWNER">{t("role.OWNER")}</option>
              <option value="CONTRACTOR">{t("role.CONTRACTOR")}</option>
              <option value="TENANT">{t("role.TENANT")}</option>
            </select>
          </div>
        )}

        {/* Role-specific sidebar — scrollable if nav items overflow */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {role === "MANAGER" ? (
            <ManagerSidebar />
          ) : role === "OWNER" ? (
            <OwnerSidebar />
          ) : role === "CONTRACTOR" ? (
            <ContractorSidebar />
          ) : role === "TENANT" ? (
            <TenantSidebar />
          ) : null}
        </div>

        {/* Sign out — always visible at bottom of sidebar */}
        <div className="pt-4 border-t border-surface-border">
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-text hover:bg-surface-border hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t("action.signOut")}
          </button>
        </div>
      </aside>

      <main
        id="main-content"
        className="min-w-0 overflow-x-hidden md:overflow-y-auto px-3 py-6 pb-24 md:px-6 md:pb-6"
      >
        {/* Header with locale switcher + notification bell */}
        {(role === "MANAGER" ||
          role === "OWNER" ||
          role === "TENANT" ||
          role === "CONTRACTOR") && (
          <div className="flex justify-end items-center gap-3 mb-4 pr-2">
            <LocaleSwitcher />
            <NotificationBell role={role} />
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav role={role} />
    </div>
    </>
  );
}
