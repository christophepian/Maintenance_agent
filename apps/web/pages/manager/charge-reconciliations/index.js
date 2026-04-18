import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Link from "next/link";
import Badge from "../../../components/ui/Badge";
import { reconciliationVariant } from "../../../lib/statusVariants";
import { authHeaders } from "../../../lib/api";
import { formatChfCents } from "../../../lib/format";
import { cn } from "../../../lib/utils";

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

  return (
    <AppShell>
      <PageShell>
        <PageHeader title="Charge Reconciliations" />
        <PageContent>
          {error && <p className="error-banner">{error}</p>}
          {/* Tab strip */}
          <div className="tab-strip">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={i === activeTab ? "pill-tab-active" : "pill-tab"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Panel bodyClassName="p-0">
            {loading && <p className="loading-text">Loading…</p>}
            {!loading && !error && items.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">No reconciliations found. Create one from a lease detail page.</p>
              </div>
            )}
            {!loading && !error && items.length > 0 && (
              <table className="inline-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th className="text-right">Acompte Paid</th>
                    <th className="text-right">Actual Costs</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href={`/manager/charge-reconciliations/${r.id}`}
                          className="cell-link"
                        >
                          {r.lease?.tenantName || "—"}
                        </Link>
                      </td>
                      <td className="tabular-nums">{r.fiscalYear}</td>
                      <td>
                        <Badge variant={reconciliationVariant(r.status)} size="sm">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums">{formatChfCents(r.totalAcomptePaidCents)}</td>
                      <td className="text-right tabular-nums">{formatChfCents(r.totalActualCostsCents)}</td>
                      <td className={cn("text-right tabular-nums", r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-green-600" : "")}>
                        {r.balanceCents > 0 ? "+" : ""}{formatChfCents(r.balanceCents)}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/manager/charge-reconciliations/${r.id}`}
                          className="cell-link"
                        >
                          {r.status === "DRAFT" ? "Edit" : "View"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
