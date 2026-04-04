import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-blue-100 text-blue-800",
  FINALIZED: "bg-amber-100 text-amber-800",
  SETTLED: "bg-emerald-100 text-emerald-800",
};

const TABS = [
  { key: "DRAFT",     label: "Draft" },
  { key: "FINALIZED", label: "Finalized" },
  { key: "SETTLED",   label: "Settled" },
  { key: "ALL",       label: "All" },
];

const TAB_KEYS = ["draft", "finalized", "settled", "all"];

export default function ChargeReconciliationsPage() {
  const router = useRouter();
  const activeTab = router.isReady ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0 : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true },
    );
  }, [router]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = TABS[activeTab].key !== "ALL" ? `?status=${TABS[activeTab].key}` : "";
      const res = await fetch(`/api/charge-reconciliations${statusParam}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load");
      setItems(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { if (router.isReady) fetchItems(); }, [fetchItems, router.isReady]);

  const fmt = (cents) => (cents / 100).toFixed(2);

  return (
    <AppShell>
      <PageShell>
        <PageHeader title="Charge Reconciliations" />
        <PageContent>
          {/* Tab strip */}
          <div className="flex gap-1 mb-4 border-b">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  i === activeTab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Panel>
            {loading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
            {error && <p className="text-sm text-destructive py-4">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                No reconciliations found. Create one from a lease detail page.
              </p>
            )}
            {!loading && !error && items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="py-2 pr-4">Tenant</th>
                      <th className="py-2 pr-4">Year</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">ACOMPTE Paid</th>
                      <th className="py-2 pr-4 text-right">Actual Costs</th>
                      <th className="py-2 pr-4 text-right">Balance</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/manager/charge-reconciliations/${r.id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {r.lease?.tenantName || "—"}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{r.fiscalYear}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[r.status] || "bg-gray-100"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{fmt(r.totalAcomptePaidCents)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{fmt(r.totalActualCostsCents)}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${
                          r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-emerald-600" : ""
                        }`}>
                          {r.balanceCents > 0 ? "+" : ""}{fmt(r.balanceCents)}
                        </td>
                        <td className="py-2 text-right">
                          <Link
                            href={`/manager/charge-reconciliations/${r.id}`}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            {r.status === "DRAFT" ? "Edit" : "View"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
