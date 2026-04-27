import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Badge from "../../../components/ui/Badge";
import { fetchWithAuth } from "../../../lib/api";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
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

const RA_SORT_FIELDS = ["tenant", "type", "effectiveDate", "status", "newRent", "change"];

function raFieldExtractor(adj, field) {
  switch (field) {
    case "tenant": return (adj.lease?.tenantName || "").toLowerCase();
    case "type": return adj.adjustmentType || "";
    case "effectiveDate": return adj.effectiveDate || "";
    case "status": return adj.status || "";
    case "newRent": return adj.newRentCents ?? 0;
    case "change": return adj.adjustmentCents ?? 0;
    default: return "";
  }
}

const RA_COLUMNS = [
  {
    id: "tenant",
    label: "Tenant",
    sortable: true,
    alwaysVisible: true,
    render: (adj) => (
      <Link href={`/manager/rent-adjustments/${adj.id}`} className="cell-link" onClick={(e) => e.stopPropagation()}>
        {adj.lease?.tenantName || "\u2014"}
      </Link>
    ),
  },
  {
    id: "type",
    label: "Type",
    sortable: true,
    defaultVisible: true,
    render: (adj) => TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType,
  },
  {
    id: "effectiveDate",
    label: "Effective",
    sortable: true,
    defaultVisible: true,
    render: (adj) => formatDate(adj.effectiveDate),
  },
  {
    id: "status",
    label: "Status",
    sortable: true,
    defaultVisible: true,
    render: (adj) => <Badge variant={rentAdjustmentVariant(adj.status)}>{adj.status}</Badge>,
  },
  {
    id: "oldRent",
    label: "Old Rent",
    defaultVisible: true,
    className: "text-right",
    render: (adj) => <span className="tabular-nums">{formatChfCents(adj.previousRentCents)}</span>,
  },
  {
    id: "newRent",
    label: "New Rent",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (adj) => <span className="tabular-nums cell-bold">{formatChfCents(adj.newRentCents)}</span>,
  },
  {
    id: "change",
    label: "Change",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (adj) => {
      const changePct = adj.previousRentCents
        ? ((adj.adjustmentCents / adj.previousRentCents) * 100).toFixed(1)
        : "\u2014";
      return (
        <span className={cn("tabular-nums", adj.adjustmentCents > 0 ? "text-red-600" : adj.adjustmentCents < 0 ? "text-green-600" : "")}>
          {adj.adjustmentCents > 0 ? "+" : ""}{formatChfCents(adj.adjustmentCents)} ({changePct}%)
        </span>
      );
    },
  },
  {
    id: "action",
    label: "",
    alwaysVisible: true,
    render: (adj) => (
      <Link href={`/manager/rent-adjustments/${adj.id}`} className="cell-link" onClick={(e) => e.stopPropagation()}>
        {adj.status === "DRAFT" ? "Edit" : "View"}
      </Link>
    ),
  },
];

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
  const { sortField, sortDir, handleSort } = useTableSort(router, RA_SORT_FIELDS, { defaultField: "effectiveDate", defaultDir: "desc" });
  const sortedAdjustments = useMemo(() => clientSort(adjustments, sortField, sortDir, raFieldExtractor), [adjustments, sortField, sortDir]);

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

          {loading ? (
            <p className="loading-text p-4">Loading…</p>
          ) : (
            <ConfigurableTable
                tableId="manager-rent-adjustments"
                columns={RA_COLUMNS}
                data={sortedAdjustments}
                rowKey={(adj) => adj.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(adj) => router.push(`/manager/rent-adjustments/${adj.id}`)}
                emptyState={
                  <div className="empty-state">
                    <p className="empty-state-text">
                      No rent adjustments found. Use the lease detail page to create adjustments.
                    </p>
                  </div>
                }
                mobileCard={(adj) => (
                  <div className="table-card">
                    <div className="flex items-start justify-between gap-2">
                      <p className="table-card-head">{adj.lease?.tenantName || "—"}</p>
                      <Badge variant={rentAdjustmentVariant(adj.status)}>{adj.status}</Badge>
                    </div>
                    <div className="table-card-footer">
                      <span>{TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType || "—"}</span>
                      <span>Effective {formatDate(adj.effectiveDate)}</span>
                      <span className={cn("tabular-nums", adj.adjustmentCents > 0 ? "text-red-600" : adj.adjustmentCents < 0 ? "text-green-600" : "")}>
                        {adj.adjustmentCents > 0 ? "+" : ""}{formatChfCents(adj.adjustmentCents)}
                      </span>
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
