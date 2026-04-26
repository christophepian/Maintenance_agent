import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
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

const RECON_SORT_FIELDS = ["tenant", "year", "status", "acompte", "actual", "balance"];

function reconFieldExtractor(r, field) {
  switch (field) {
    case "tenant": return (r.lease?.tenantName || "").toLowerCase();
    case "year": return r.fiscalYear ?? 0;
    case "status": return r.status || "";
    case "acompte": return r.totalAcomptePaidCents ?? 0;
    case "actual": return r.totalActualCostsCents ?? 0;
    case "balance": return r.balanceCents ?? 0;
    default: return "";
  }
}

const RECON_COLUMNS = [
  {
    id: "tenant",
    label: "Tenant",
    sortable: true,
    alwaysVisible: true,
    render: (r) => (
      <Link href={`/manager/charge-reconciliations/${r.id}`} className="cell-link" onClick={(e) => e.stopPropagation()}>
        {r.lease?.tenantName || "\u2014"}
      </Link>
    ),
  },
  {
    id: "year",
    label: "Year",
    sortable: true,
    defaultVisible: true,
    render: (r) => <span className="tabular-nums">{r.fiscalYear}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortable: true,
    defaultVisible: true,
    render: (r) => <Badge variant={reconciliationVariant(r.status)} size="sm">{r.status}</Badge>,
  },
  {
    id: "acompte",
    label: "Acompte Paid",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (r) => <span className="tabular-nums">{formatChfCents(r.totalAcomptePaidCents)}</span>,
  },
  {
    id: "actual",
    label: "Actual Costs",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (r) => <span className="tabular-nums">{formatChfCents(r.totalActualCostsCents)}</span>,
  },
  {
    id: "balance",
    label: "Balance",
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (r) => (
      <span className={cn("tabular-nums", r.balanceCents > 0 ? "text-red-600" : r.balanceCents < 0 ? "text-green-600" : "")}>
        {r.balanceCents > 0 ? "+" : ""}{formatChfCents(r.balanceCents)}
      </span>
    ),
  },
  {
    id: "actions",
    label: "",
    alwaysVisible: true,
    className: "text-right",
    render: (r) => (
      <Link href={`/manager/charge-reconciliations/${r.id}`} className="cell-link" onClick={(e) => e.stopPropagation()}>
        {r.status === "DRAFT" ? "Edit" : "View"}
      </Link>
    ),
  },
];

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
  const { sortField, sortDir, handleSort } = useTableSort(router, RECON_SORT_FIELDS, { defaultField: "year", defaultDir: "desc" });
  const sortedItems = useMemo(() => clientSort(items, sortField, sortDir, reconFieldExtractor), [items, sortField, sortDir]);

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

          {loading && <p className="loading-text">Loading…</p>}
          {!loading && !error && (
            <ConfigurableTable
                tableId="manager-charge-reconciliations"
                columns={RECON_COLUMNS}
                data={sortedItems}
                rowKey={(r) => r.id}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(r) => router.push(`/manager/charge-reconciliations/${r.id}`)}
                emptyState={
                  <div className="empty-state">
                    <p className="empty-state-text">No reconciliations found. Create one from a lease detail page.</p>
                  </div>
                }
            />
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
