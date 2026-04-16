// TEMPLATE FILE — copy and rename, do not use directly.
// This is the canonical detail page structure (F-UI2 in PROJECT_STATE.md).
// Every detail page must follow this exact layout.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { authHeaders } from "../../lib/api";

export default function TemplateDetailPage() {
  const router = useRouter();
  // REPLACE: Extract the entity ID from the URL, e.g. router.query.id
  const { id } = router.query;

  // REPLACE: Data state — add your entity state here.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // REPLACE: Data fetching — uncomment and adapt for your API endpoint.
  // const loadData = useCallback(async () => {
  //   if (!id) return;
  //   setLoading(true);
  //   setError("");
  //   try {
  //     const res = await fetch(`/api/your-endpoint/${id}`, { headers: authHeaders() });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data?.error?.message || "Failed to load");
  //     // setYourEntity(data?.data);
  //   } catch (e) {
  //     setError(String(e?.message || e));
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [id]);
  // useEffect(() => { loadData(); }, [loadData]);

  // Placeholder: simulate loaded state
  useEffect(() => { setLoading(false); }, []);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        {/* ── PageHeader ──
             Title and subtitle describe the entity.
             The `actions` prop holds entity-level CTAs (Edit, Delete, etc.) */}
        <PageHeader
          // REPLACE: Dynamic entity title, e.g. `${entity.name}`
          title="Template Detail Page"
          subtitle={`ID: ${id ?? "—"}`}
          // REPLACE: Entity-level actions
          actions={
            <button className="button-primary text-sm">
              Edit
            </button>
          }
        />

        {/* ── PageContent ──
             Direct children: error banner → Panel sections.
             Each Panel is a visual card. Use ONE per logical section.
             Default padding for key-value fields, bodyClassName="p-0" for tables. */}
        <PageContent>
          {/* ── Error banner ── */}
          <ErrorBanner error={error} />

          {loading ? (
            <p className="loading-text">Loading…</p>
          ) : (
            <>
              {/* ── Section 1: Key-value fields ──
                   Panel with DEFAULT padding — do NOT pass bodyClassName="p-0".
                   Use a simple grid or definition list for entity properties. */}
              <Panel title="Details">
                {/* REPLACE: Entity fields — use a dl/grid layout */}
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Field One</dt>
                    <dd className="mt-1 text-sm text-slate-900">Value placeholder</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Field Two</dt>
                    <dd className="mt-1 text-sm text-slate-900">Value placeholder</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Field Three</dt>
                    <dd className="mt-1 text-sm text-slate-900">Value placeholder</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Field Four</dt>
                    <dd className="mt-1 text-sm text-slate-900">Value placeholder</dd>
                  </div>
                </dl>
              </Panel>

              {/* ── Section 2: Related items table ──
                   Panel with bodyClassName="p-0" so the table sits flush.
                   Use the inline-table CSS class from globals.css. */}
              <Panel title="Related Items" bodyClassName="p-0">
                {/* REPLACE: Table of related entities */}
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th className="cell-bold">Name</th>
                      <th className="cell-bold">Status</th>
                      <th className="cell-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* REPLACE: Table rows — map over related items */}
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                        No related items yet.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Panel>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
