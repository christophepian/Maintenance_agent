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
import { clientSort } from "../../lib/tableUtils";
import { SortToggle, SortPanelBody, SortRow } from "../../components/ui/FilterPanel";
import { formatChfCents, formatDate } from "../../lib/format";
import { billingScheduleVariant } from "../../lib/statusVariants";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

const TABS = [
  { key: "ACTIVE" },
  { key: "PAUSED" },
  { key: "COMPLETED" },
  { key: "ALL" },
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
  const { t } = useTranslation("manager");
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
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("tenant");
  const [sortDir, setSortDir] = useState("asc");
  const [sortOpen, setSortOpen] = useState(false);
  const handleSort = useCallback((field, dir) => {
    setSortField(field);
    setSortDir(dir !== undefined ? dir : (field === sortField ? (sortDir === "asc" ? "desc" : "asc") : "asc"));
  }, [sortField, sortDir]);
  const sortActive = sortField !== "tenant";
  const filteredSchedules = useMemo(() => {
    if (!search.trim()) return schedules;
    const q = search.toLowerCase();
    return schedules.filter((s) => (s.lease?.tenantName || "").toLowerCase().includes(q));
  }, [schedules, search]);
  const sortedSchedules = useMemo(() => clientSort(filteredSchedules, sortField, sortDir, bsFieldExtractor), [filteredSchedules, sortField, sortDir]);

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
          title={t("manager:billingSchedules.title.billingSchedules")}
          subtitle={t("manager:billing_Schedules.prop.recurringInvoicesGeneratedAutomaticallyForActiveLeases")}
        />
        <PageContent>
          {error && (
            <div className="notice notice-err mt-3">
              <strong className="text-red-700">{t("manager:billing_Schedules.text.error")}</strong> {error}
            </div>
          )}

          {/* Tab strip */}
          <ScrollableTabs activeIndex={activeTab}>
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "pill-tab-active" : "pill-tab"}
              >
                {t(`manager:billingSchedules.tabs.${tab.key.toLowerCase()}`)}
              </button>
            ))}
          </ScrollableTabs>

          <span className="tab-panel-count">
            {loading ? "" : `${sortedSchedules.length} schedule${sortedSchedules.length !== 1 ? "s" : ""}`}
          </span>

          {loading ? (
            <p className="loading-text p-4">{t("manager:billing_Schedules.text.loadingSchedules")}</p>
          ) : (
            <ConfigurableTable
                toolbarSlot={
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="search"
                      placeholder={t("manager:billingSchedules.placeholder.searchByTenant")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="filter-input flex-1 min-w-0 mb-0"
                    />
                    <SortToggle open={sortOpen} onToggle={() => setSortOpen((v) => !v)} active={sortActive} />
                  </div>
                }
                toolbarPanel={
                  <>
                    {sortOpen && (
                      <SortPanelBody>
                        <SortRow active={sortField === "tenant"} dir={sortField === "tenant" ? sortDir : "asc"} label="Tenant" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("tenant", dir)} />
                        <SortRow active={sortField === "total"} dir={sortField === "total" ? sortDir : "desc"} label="Total" descLabel="High → Low" ascLabel="Low → High" onSelect={(dir) => handleSort("total", dir)} />
                        <SortRow active={sortField === "nextPeriod"} dir={sortField === "nextPeriod" ? sortDir : "asc"} label="Next Period" ascLabel="Soonest first" descLabel="Latest first" onSelect={(dir) => handleSort("nextPeriod", dir)} />
                        <SortRow active={sortField === "status"} dir={sortField === "status" ? sortDir : "asc"} label="Status" ascLabel="A → Z" descLabel="Z → A" onSelect={(dir) => handleSort("status", dir)} />
                      </SortPanelBody>
                    )}
                  </>
                }
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
                          <span className="text-xs text-foreground-dim">{s.completionReason || "—"}</span>
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
                mobileCard={(sched) => (
                  <div className="table-card">
                    <div className="flex items-start justify-between gap-2">
                      <p className="table-card-head">{sched.lease?.tenantName || "—"}</p>
                      <Badge variant={billingScheduleVariant(sched.status)}>{sched.status}</Badge>
                    </div>
                    <div className="table-card-footer">
                      <span className="tabular-nums">{formatChfCents(sched.baseRentCents + sched.totalChargesCents)}</span>
                      {sched.nextPeriodStart && <span>Next {formatDate(sched.nextPeriodStart)}</span>}
                    </div>
                  </div>
                )}
            />
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
