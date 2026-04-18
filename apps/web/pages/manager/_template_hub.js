// TEMPLATE FILE — copy and rename, do not use directly.
// This is the canonical hub page structure (F-UI1 in PROJECT_STATE.md).
// Every hub page with tabs must follow this exact layout.
//
// ── TAB VARIANT RULES ──────────────────────────────────────────────────────
// This template uses UNDERLINE TABS — the correct choice for hub pages.
// There are three tab variants. Pick based on what the tabs control:
//
//  1. UNDERLINE TABS  → page-level navigation between different data domains
//     Use: Tabs + TabsList + TabsTrigger (default, no unstyled prop)
//     Example: Finance page (Overview / Invoices / Billing Entities / ...)
//
//  2. SEGMENTED CONTROL  → view/filter switch on the same data set
//     Use: Tabs + TabsList + TabsTrigger unstyled + blue filled active classes
//     TabsList className: "flex gap-1 rounded-lg border border-slate-200 bg-white p-1"
//     TabsTrigger className: "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
//       text-slate-600 hover:bg-slate-100 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
//     Example: Reports page (Overview / Contractors / ...) — same page, filtered views
//
//  3. PILL TABS  → section navigation within a detail page (single record)
//     Use: Tabs + TabsList className="pill-tab-row" + TabsTrigger unstyled className="pill-tab ..."
//     Example: Unit detail page (Tenants / Appliances / Assets / ...)
//
// See docs/design-system-audit.md § "Tab patterns" for full spec.
// ───────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Link from "next/link";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { authHeaders } from "../../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/Tabs";

// REPLACE: Tab definitions — key must be URL-safe (lowercase, hyphens).
const TABS = [
  { key: "tab-one", label: "Tab one" },
  { key: "tab-two", label: "Tab two" },
];

export default function TemplateHubPage() {
  const router = useRouter();

  // ── Tab state — driven by URL query param for deep-linkability ──
  // Default to the first tab key if the query param is absent or invalid.
  const tabKeys = TABS.map((t) => t.key);
  const activeTab = router.isReady && tabKeys.includes(router.query.tab)
    ? router.query.tab
    : TABS[0].key;
  const setActiveTab = useCallback(
    (key) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: key } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  // REPLACE: Data state — add your state variables here.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // REPLACE: Data fetching — uncomment and adapt for your API endpoints.
  // const loadData = useCallback(async () => {
  //   setLoading(true);
  //   setError("");
  //   try {
  //     const res = await fetch("/api/your-endpoint", { headers: authHeaders() });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data?.error?.message || "Failed to load");
  //     // setYourState(data?.data || []);
  //   } catch (e) {
  //     setError(String(e?.message || e));
  //   } finally {
  //     setLoading(false);
  //   }
  // }, []);
  // useEffect(() => { loadData(); }, [loadData]);

  // Placeholder: simulate loaded state
  useEffect(() => { setLoading(false); }, []);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        {/* ── PageHeader ──
             Title and subtitle describe the page.
             The `actions` prop is where page-level CTAs live (buttons, links).
             NEVER place CTAs between the header and the tab strip. */}
        <PageHeader
          // REPLACE: Page title and subtitle
          title="Template Hub Page"
          subtitle="A starter hub page — copy and rename this file."
          // REPLACE: Page-level actions (buttons, links) — rendered right-aligned.
          actions={
            <button className="button-primary text-sm">
              + Action
            </button>
          }
        />

        {/* ── PageContent ──
             Direct children, in order:
             1. Error banner (conditional)
             2. Tab strip
             3. Panel wrapping all tab panels */}
        <PageContent>
          {/* ── Error banner — sits at the top of PageContent, outside the tabs. */}
          <ErrorBanner error={error} />

          {/* ── Tabs — wraps strip + all panels.
               value/onValueChange drives URL-persisted tab state.
               This is UNDERLINE TABS (hub page variant — see comment at top of file). */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* ── Tab strip — direct child of Tabs, BEFORE the Panel. */}
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Count + full-view link — sits between TabsList and Panel.
                 Conditional per active tab. */}
            {activeTab === "tab-one" && (
              <>
                <span className="tab-panel-count">0 items</span>
                {/* REPLACE: Conditional full-view link per tab */}
                <Link href="/manager" className="full-page-link">Full view →</Link>
              </>
            )}
            {activeTab === "tab-two" && (
              <span className="tab-panel-count">0 items</span>
            )}

            {/* ── Panel — wraps ONLY the TabsContent panels.
                 bodyClassName="p-0" removes default padding so that
                 inline-tables sit flush against panel edges. */}
            <Panel bodyClassName="p-0">
              {/* ── Tab one panel ──
                   Tables sit flush (no wrapper needed).
                   Non-table content (forms, empty states) needs:
                   <div className="px-4 py-4"> wrapper inside TabsContent. */}
              <TabsContent value="tab-one">
                {/* REPLACE: Tab content — table, cards, empty state, etc. */}
                {loading ? (
                  <p className="loading-text">Loading…</p>
                ) : (
                  <div className="px-4 py-4">
                    <div className="empty-state">
                      <p className="empty-state-text">
                        Tab one placeholder — replace with real content.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab two panel ── */}
              <TabsContent value="tab-two">
                {/* REPLACE: Tab content */}
                {loading ? (
                  <p className="loading-text">Loading…</p>
                ) : (
                  <div className="px-4 py-4">
                    <div className="empty-state">
                      <p className="empty-state-text">
                        Tab two placeholder — replace with real content.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Panel>
          </Tabs>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
