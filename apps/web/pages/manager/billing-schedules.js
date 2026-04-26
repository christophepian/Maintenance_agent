import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Link from "next/link";
import { authHeaders } from "../../lib/api";
import ConfigurableTable from "../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import { formatChfCents, formatDate } from "../../lib/format";
import { billingScheduleVariant } from "../../lib/statusVariants";

const TABS = [
  { key: "ACTIVE",    label: "Active" },
  { key: "PAUSED",    label: "Paused" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ALL",       label: "All" },
];

const TAB_KEYS = ["active", "paused", "completed", "all"];

const BS_SORT_FIELDS = ["tenant", "status", "baseRent", "total", "nextPeriod", "anchorDay"];

function bsFieldExtractor(s, field) {
  switch (field) {
    case "tenant": return (s.lease?.tenantName || "").toLowerCase();
    case "status": return s.status || "";
    case "baseRent": return s.baseRentCents ?? 0;
    case "total": return (s.baseRentCents ?? 0) + (s.totalChargesCents ?? 0);
    case "nextPeriod": return s.nextPeriodStart || "";
    case "anchorDay": return s.anchorDay ?? 0;
    default: return "";
  }
}

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
  const { sortField, sortDir, handleSort } = useTableSort(router, BS_SORT_FIELDS, { defaultField: "tenant", defaultDir: "asc" });
  const sortedSchedules = useMemo(() => clientSort(schedules, sortField, sortDir, bsFieldExtractor), [schedules, sortField, sortDir]);

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
              <strong className="text-red-700">Error:</strong> {error}
            </div>
          )}

          {/* Tab strip */}
          <div className="tab-strip">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "pill-tab-active" : "pill-tab"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="tab-panel-count">
            {loading ? "" : `${schedules.length} schedule${schedules.length !== 1 ? "s" : ""}`}
          </span>

          {loading ? (
            <p className="loading-text p-4">Loading schedules…</p>
          ) : (
            <ConfigurableTable
                tableId="manager-billing-schedules"
                columns={useMemo(() => [
                  {
                    id: "tenant",
                    label: "Tenant",
                    sortable: true,
                    alwaysVisible: true,
                    render: (s) => s.lease ? (
                      <Link href={`/manager/leases/${s.leaseId}`} className="cell-link" onClick={(e) => e.stopPropagation()}>
                        {s.lease.tenantName || "—"}
                      </Link>
                    ) : "—",
                  },
                  {
                    id: "status",
                    label: "Status",
                    sortable: true,
                    defaultVisible: true,
                    render: (s) => <Badge variant={billingScheduleVariant(s.status)}>{s.status}</Badge>,
                  },
                  {
                    id: "baseRent",
                    label: "Base Rent",
                    sortable: true,
                    defaultVisible: true,
                    render: (s) => <span className="tabular-nums">{formatChfCents(s.baseRentCents)}</span>,
                  },
                  {
                    id: "charges",
                    label: "Charges",
                    defaultVisible: true,
                    render: (s) => <span className="tabular-nums">{formatChfCents(s.totalChargesCents)}</span>,
                  },
                  {
                    id: "total",
                    label: "Total",
                    sortable: true,
                    defaultVisible: true,
                    render: (s) => <span className="tabular-nums cell-bold">{formatChfCents(s.baseRentCents + s.totalChargesCents)}</span>,
                  },
                  {
                    id: "nextPeriod",
                    label: "Next Period",
                    sortable: true,
                    defaultVisible: true,
                    render: (s) => s.nextPeriodStart ? formatDate(s.nextPeriodStart) : "—",
                  },
                  {
                    id: "anchorDay",
                    label: "Anchor Day",
                    sortable: true,
                    defaultVisible: true,
                    render: (s) => s.anchorDay,
                  },
                  {
                    id: "actions",
                    label: "Actions",
                    alwaysVisible: true,
                    render: (s) => (
                      <>
                        {s.status === "ACTIVE" && (
                          <Button variant="warning" size="sm" onClick={(e) => { e.stopPropagation(); handleAction(s.id, "pause"); }} disabled={actionLoading === s.id}>
                            {actionLoading === s.id ? "…" : "Pause"}
                          </Button>
                        )}
                        {s.status === "PAUSED" && (
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleAction(s.id, "resume"); }} disabled={actionLoading === s.id}>
                            {actionLoading === s.id ? "…" : "Resume"}
                          </Button>
                        )}
                        {s.status === "COMPLETED" && (
                          <span className="text-xs text-slate-400">{s.completionReason || "—"}</span>
                        )}
                      </>
                    ),
                  },
                ], [handleAction, actionLoading])}
                data={sortedSchedules}
                rowKey={(s) => s.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                emptyState={
                  <div className="empty-state">
                    <p className="empty-state-text">
                      No {TABS[activeTab].key !== "ALL" ? TABS[activeTab].label.toLowerCase() : ""} billing schedules found.
                    </p>
                  </div>
                }
            />
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
