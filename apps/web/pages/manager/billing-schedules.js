import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../lib/api";
import { formatDate } from "../../lib/format";

const STATUS_COLORS = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-slate-100 text-slate-700",
};

const TABS = [
  { key: "ACTIVE",    label: "Active" },
  { key: "PAUSED",    label: "Paused" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ALL",       label: "All" },
];

const TAB_KEYS = ["active", "paused", "completed", "all"];

export default function BillingSchedulesPage() {
  const router = useRouter();
  const activeTab = router.isReady ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0 : 0;
  const setActiveTab = useCallback((index) => {
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true },
    );
  }, [router]);

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = TABS[activeTab].key !== "ALL" ? `?status=${TABS[activeTab].key}` : "";
      const res = await fetch(`/api/billing-schedules${statusParam}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load");
      setSchedules(json.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  async function handleAction(scheduleId, action) {
    setActionLoading(scheduleId);
    try {
      const res = await fetch(`/api/billing-schedules/${scheduleId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || `Failed to ${action}`);
      }
      await fetchSchedules();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Billing Schedules"
          subtitle="Recurring invoices generated automatically for active leases."
        />
        <PageContent>
          {error && (
            <div className="notice notice-err mt-3">
              <strong className="text-err-text">Error:</strong> {error}
            </div>
          )}

          {/* Tab strip */}
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

          <span className="tab-panel-count">
            {loading ? "" : `${schedules.length} schedule${schedules.length !== 1 ? "s" : ""}`}
          </span>

          <Panel bodyClassName="p-0">
            {loading ? (
              <p className="loading-text p-4">Loading schedules…</p>
            ) : schedules.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">
                  No {TABS[activeTab].key !== "ALL" ? TABS[activeTab].label.toLowerCase() : ""} billing schedules found.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Status</th>
                      <th>Base Rent</th>
                      <th>Charges</th>
                      <th>Total</th>
                      <th>Next Period</th>
                      <th>Anchor Day</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s) => {
                      const rentChf = s.baseRentCents / 100;
                      const chargesChf = s.totalChargesCents / 100;
                      const totalChf = rentChf + chargesChf;
                      return (
                        <tr key={s.id}>
                          <td className="cell-bold">
                            {s.lease ? (
                              <Link href={`/manager/leases/${s.leaseId}`} className="text-indigo-600 hover:underline">
                                {s.lease.tenantName || "—"}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] || "bg-slate-100 text-slate-700"}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>CHF {rentChf.toFixed(2)}</td>
                          <td>CHF {chargesChf.toFixed(2)}</td>
                          <td className="cell-bold">CHF {totalChf.toFixed(2)}</td>
                          <td>{s.nextPeriodStart ? new Date(s.nextPeriodStart).toLocaleDateString("de-CH") : "—"}</td>
                          <td>{s.anchorDay}</td>
                          <td>
                            {s.status === "ACTIVE" && (
                              <button
                                onClick={() => handleAction(s.id, "pause")}
                                disabled={actionLoading === s.id}
                                className="px-2 py-1 text-xs font-medium rounded border border-yellow-300 text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                              >
                                {actionLoading === s.id ? "…" : "Pause"}
                              </button>
                            )}
                            {s.status === "PAUSED" && (
                              <button
                                onClick={() => handleAction(s.id, "resume")}
                                disabled={actionLoading === s.id}
                                className="px-2 py-1 text-xs font-medium rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {actionLoading === s.id ? "…" : "Resume"}
                              </button>
                            )}
                            {s.status === "COMPLETED" && (
                              <span className="text-xs text-slate-400">
                                {s.completionReason || "—"}
                              </span>
                            )}
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
