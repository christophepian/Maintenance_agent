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
import ScrollableTabs from "../../../components/mobile/ScrollableTabs";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

const TYPE_LABELS = {
  CPI_INDEXATION: "CPI Indexation",
  REFERENCE_RATE_CHANGE: "Ref. Rate Change",
  MANUAL: "Manual",
};

const TABS = [
  { key: "ALL" },
  { key: "DRAFT" },
  { key: "APPROVED" },
  { key: "APPLIED" },
  { key: "REJECTED" },
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

function buildRaColumns(t) {
  return [
  {
    id: "tenant",
    label: t("manager:rentAdjustments.col.tenant"),
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
    label: t("manager:rentAdjustments.col.type"),
    sortable: true,
    defaultVisible: true,
    render: (adj) => TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType,
  },
  {
    id: "effectiveDate",
    label: t("manager:rentAdjustments.col.effective"),
    sortable: true,
    defaultVisible: true,
    render: (adj) => formatDate(adj.effectiveDate),
  },
  {
    id: "status",
    label: t("manager:rentAdjustments.col.status"),
    sortable: true,
    defaultVisible: true,
    render: (adj) => <Badge variant={rentAdjustmentVariant(adj.status)}>{adj.status}</Badge>,
  },
  {
    id: "oldRent",
    label: t("manager:rentAdjustments.col.oldRent"),
    defaultVisible: true,
    className: "text-right",
    render: (adj) => <span className="tabular-nums">{formatChfCents(adj.previousRentCents)}</span>,
  },
  {
    id: "newRent",
    label: t("manager:rentAdjustments.col.newRent"),
    sortable: true,
    defaultVisible: true,
    className: "text-right",
    render: (adj) => <span className="tabular-nums cell-bold">{formatChfCents(adj.newRentCents)}</span>,
  },
  {
    id: "change",
    label: t("manager:rentAdjustments.col.change"),
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
}

export default function RentAdjustmentsList() {
  const { t } = useTranslation("manager");
  const raColumns = useMemo(() => buildRaColumns(t), [t]);
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
          title={t("manager:rentAdjustmentsIndex.title.rentAdjustments")}
          subtitle={t("manager:rent_AdjustmentsIndex.prop.cPIindexedAndManualRentAdjustments")}
        />
        <PageContent>
          <ScrollableTabs activeIndex={activeTab}>
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={activeTab === i ? "pill-tab-active" : "pill-tab"}
              >
                {t(`manager:rentAdjustments.tabs.${tab.key.toLowerCase()}`)}
              </button>
            ))}
          </ScrollableTabs>

          {loading ? (
            <p className="loading-text p-4">{t("manager:rent_AdjustmentsIndex.text.loading")}</p>
          ) : (
            <ConfigurableTable
                tableId="manager-rent-adjustments"
                columns={raColumns}
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

export const getStaticProps = withTranslations(["common","manager"]);
