import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Badge from "../../../components/ui/Badge";
import { fetchWithAuth } from "../../../lib/api";
import { formatChfCents, formatDate } from "../../../lib/format";
import { rentAdjustmentVariant } from "../../../lib/statusVariants";
import { cn } from "../../../lib/utils";

const TYPE_LABELS = {
  CPI_INDEXATION: "CPI Indexation",
  REFERENCE_RATE_CHANGE: "Ref. Rate Change",
  MANUAL: "Manual",
};

const TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "APPROVED", label: "Approved" },
  { key: "APPLIED", label: "Applied" },
  { key: "REJECTED", label: "Rejected" },
];
const TAB_KEYS = TABS.map((t) => t.key.toLowerCase());

export default function RentAdjustmentsList() {
  const router = useRouter();
  const activeTab = router.isReady
    ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0
    : 0;
  const setActiveTab = useCallback(
    (index) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (TABS[activeTab].key !== "ALL") params.set("status", TABS[activeTab].key);
      const res = await fetchWithAuth(`/api/rent-adjustments?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAdjustments(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load rent adjustments:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title="Rent Adjustments"
          subtitle="CPI-indexed and manual rent adjustments"
        />
        <PageContent>
          <div className="tab-strip">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "pill-tab-active" : "pill-tab"}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Panel bodyClassName="p-0">
            {loading ? (
              <p className="loading-text p-4">Loading…</p>
            ) : adjustments.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">
                  No rent adjustments found. Use the lease detail page to create adjustments.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Type</th>
                      <th>Effective</th>
                      <th>Status</th>
                      <th className="text-right">Old Rent</th>
                      <th className="text-right">New Rent</th>
                      <th className="text-right">Change</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map((adj) => {
                      const changePct = adj.previousRentCents
                        ? ((adj.adjustmentCents / adj.previousRentCents) * 100).toFixed(1)
                        : "—";
                      return (
                        <tr key={adj.id}>
                          <td className="cell-bold">
                            <Link
                              href={`/manager/rent-adjustments/${adj.id}`}
                              className="cell-link"
                            >
                              {adj.lease?.tenantName || "—"}
                            </Link>
                          </td>
                          <td>{TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType}</td>
                          <td>{formatDate(adj.effectiveDate)}</td>
                          <td>
                            <Badge variant={rentAdjustmentVariant(adj.status)}>
                              {adj.status}
                            </Badge>
                          </td>
                          <td className="text-right">{formatChfCents(adj.previousRentCents)}</td>
                          <td className="text-right cell-bold">{formatChfCents(adj.newRentCents)}</td>
                          <td
                            className={cn(
                              "text-right",
                              adj.adjustmentCents > 0
                                ? "text-red-600"
                                : adj.adjustmentCents < 0
                                  ? "text-green-600"
                                  : "",
                            )}
                          >
                            {adj.adjustmentCents > 0 ? "+" : ""}
                            {formatChfCents(adj.adjustmentCents)} ({changePct}%)
                          </td>
                          <td>
                            <Link
                              href={`/manager/rent-adjustments/${adj.id}`}
                              className="cell-link"
                            >
                              {adj.status === "DRAFT" ? "Edit" : "View"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
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
