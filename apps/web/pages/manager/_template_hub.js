// TEMPLATE FILE — copy and rename, do not use directly.
// This is the canonical hub page structure (F-UI1 in PROJECT_STATE.md).
// Every hub page with tabs must follow this exact layout.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../lib/api";

// REPLACE: Tab definitions — one object per tab with a key and label.
const TABS = [
  { key: "TAB_ONE", label: "Tab one" },
  { key: "TAB_TWO", label: "Tab two" },
];

// REPLACE: URL-safe tab keys — used for ?tab= query param routing.
const TAB_KEYS = ["tab_one", "tab_two"];

export default function TemplateHubPage() {
  const router = useRouter();

  // ── Tab state — driven by URL query param for deep-linkability ──
  const activeTab = router.isReady ? (Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0) : 0;
  const setActiveTab = useCallback(
    (index) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
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
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
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
          {/* ── Error banner — sits at the top of PageContent, outside both
               the tab strip and the Panel. */}
          {error && <div className="error-banner">{error}</div>}

          {/* ── Tab strip — direct child of PageContent, BEFORE the Panel.
               Uses CSS classes from globals.css @layer components. */}
          <div className="tab-strip">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "tab-btn-active" : "tab-btn"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Count + full-view link — sits between tab strip and Panel card.
               tab-panel-count is a block element with margin-bottom via CSS.
               Full-view links are conditional per activeTab. */}
          <span className="tab-panel-count">
            {activeTab === 0 ? "0 items" : null}
            {activeTab === 1 ? "0 items" : null}
          </span>
          {/* REPLACE: Conditional full-view link per tab */}
          {activeTab === 0 && <Link href="/manager" className="full-page-link">Full view →</Link>}

          {/* ── Panel — wraps ONLY the tab panel divs.
               bodyClassName="p-0" removes default padding so that
               inline-tables can sit flush against the panel edges. */}
          <Panel bodyClassName="p-0">
            {/* ── Tab one panel ──
                 tab-panel-active / tab-panel controls visibility via CSS.
                 Tables sit flush; use <div className="px-4 py-4"> wrapper
                 only for non-table content (forms, coming-soon, etc.). */}
            <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
              {/* REPLACE: Tab content — table, cards, empty state, etc. */}
              {loading ? (
                <p className="loading-text">Loading…</p>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-text">
                    Tab one placeholder — replace with real content.
                  </p>
                </div>
              )}
            </div>

            {/* ── Tab two panel ── */}
            <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
              {/* REPLACE: Tab content */}
              {loading ? (
                <p className="loading-text">Loading…</p>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-text">
                    Tab two placeholder — replace with real content.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
