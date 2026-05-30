import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import ContractorPicker from "../../components/ContractorPicker";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { rfpVariant, quoteVariant } from "../../lib/statusVariants";
import { formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";
import ConfigurableTable from "../../components/ConfigurableTable";
import { useTableSort, clientSort } from "../../lib/tableUtils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";

const STATUS_TABS = [
  { key: "ALL" },
  { key: "OPEN" },
  { key: "AWARDED" },
  { key: "CANCELLED" },
];

const CRFP_SORT_FIELDS = ["category", "status", "invites", "quotes", "createdAt"];

function crfpFieldExtractor(rfp, field) {
  switch (field) {
    case "category": return (rfp.category || "").toLowerCase();
    case "status": return rfp.status || "";
    case "invites": return rfp.inviteCount ?? 0;
    case "quotes": return rfp.quoteCount ?? 0;
    case "createdAt": return rfp.createdAt || "";
    default: return "";
  }
}

function buildCrfpColumns(t) {
  return [
  {
    id: "request",
    label: t("contractor:rfps.col.request"),
    alwaysVisible: true,
    render: (rfp) => rfp.request ? (
      <span className="text-sm">
        <span className="font-medium text-foreground">#{rfp.request.requestNumber}</span>
        <span className="block text-xs text-muted max-w-[200px] truncate">{rfp.request.description}</span>
      </span>
    ) : <span className="text-xs text-foreground-dim">\u2014</span>,
  },
  {
    id: "category",
    label: t("contractor:rfps.col.category"),
    sortable: true,
    defaultVisible: true,
    render: (rfp) => <span className="text-sm text-muted-dark">{rfp.category || "\u2014"}</span>,
  },
  {
    id: "location",
    label: t("contractor:rfps.col.location"),
    defaultVisible: true,
    render: (rfp) => (
      <span className="text-sm text-muted-dark">
        {rfp.buildingName || "\u2014"}
        {rfp.postalCode && <span className="text-foreground-dim text-xs ml-1">({rfp.postalCode})</span>}
        {rfp.unitNumber && <span className="text-foreground-dim"> / {rfp.unitNumber}</span>}
      </span>
    ),
  },
  {
    id: "status",
    label: t("contractor:rfps.col.status"),
    sortable: true,
    defaultVisible: true,
    render: (rfp) => (
      <>
        <Badge variant={rfpVariant(rfp.status)} size="sm">{rfp.status}</Badge>
        {rfp.isInvited && <Badge variant="brand" size="sm" className="ml-1">{t("contractor:rfps.text.invited")}</Badge>}
      </>
    ),
  },
  {
    id: "myQuote",
    label: t("contractor:rfps.col.myQuote"),
    defaultVisible: true,
    render: (rfp) => rfp.myQuote ? (
      <Badge variant={quoteVariant(rfp.myQuote.status)} size="sm">
        {rfp.myQuote.status === "AWARDED" ? "Won" : rfp.myQuote.status === "REJECTED" ? "Not selected" : "Submitted"}
      </Badge>
    ) : <span className="text-xs text-foreground-dim">\u2014</span>,
  },
  {
    id: "invites",
    label: t("contractor:rfps.col.invited"),
    sortable: true,
    defaultVisible: true,
    className: "text-center",
    render: (rfp) => <span className="text-sm text-muted-dark">{rfp.inviteCount}</span>,
  },
  {
    id: "quotes",
    label: t("contractor:rfps.col.quotes"),
    sortable: true,
    defaultVisible: true,
    className: "text-center",
    render: (rfp) => <span className={rfp.quoteCount > 0 ? "font-medium text-green-700 text-sm" : "text-sm text-muted-dark"}>{rfp.quoteCount}</span>,
  },
  {
    id: "createdAt",
    label: t("contractor:rfps.col.created"),
    sortable: true,
    defaultVisible: true,
    render: (rfp) => <span className="text-sm text-muted">{formatDate(rfp.createdAt)}</span>,
  },
  {
    id: "view",
    label: "",
    alwaysVisible: true,
    render: (rfp) => (
      <Link href={`/contractor/rfps/${rfp.id}`} className="cell-link text-xs font-medium" onClick={(e) => e.stopPropagation()}>{t("contractor:rfps.text.view")}</Link>
    ),
  },
];
}

export default function ContractorRfpsPage() {
  const { t } = useTranslation("contractor");
  const crfpColumns = useMemo(() => buildCrfpColumns(t), [t]);
  const router = useRouter();
  const [rfps, setRfps] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const { sortField, sortDir, handleSort } = useTableSort(router, CRFP_SORT_FIELDS, { defaultField: "createdAt", defaultDir: "desc" });
  const sortedRfps = useMemo(() => clientSort(rfps, sortField, sortDir, crfpFieldExtractor), [rfps, sortField, sortDir]);

  const loadData = useCallback(async () => {
    const contractorId =
      typeof window !== "undefined" ? localStorage.getItem("contractorId") : null;
    if (!contractorId) {
      setRfps([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ contractorId });
      if (activeTab !== "ALL") params.set("status", activeTab);
      const res = await fetch(`/api/contractor/rfps?${params}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error?.message || data?.message || "Failed to load RFPs");
      setRfps(data?.data || []);
      setTotal(data?.total ?? data?.data?.length ?? 0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AppShell role="CONTRACTOR">
      <div className="max-w-[1200px]">
        <h1 className="mt-0 mb-6">{t("contractor:rfps.heading.availableRfps")}</h1>

        <ContractorPicker onSelect={() => loadData()} />

        <ErrorBanner error={error} onDismiss={() => setError("")} className="mb-4" />

        {/* Status tabs */}
        <div className="pill-tab-row">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === "ALL" ? rfps.length : rfps.filter((r) => r.status === tab.key).length;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={active ? "pill-tab pill-tab-active" : "pill-tab"}
              >
                {t(`contractor:rfps.tabs.${tab.key.toLowerCase()}`)} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-muted-text">{t("contractor:rfps.text.loadingRfps")}</p>
        ) : (
          <ConfigurableTable
            tableId="contractor-rfps"
            columns={crfpColumns}
            data={sortedRfps}
            rowKey={(rfp) => rfp.id}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(rfp) => router.push(`/contractor/rfps/${rfp.id}`)}
            emptyState={
              <div className="bg-surface-subtle border border-surface-border rounded p-8 text-center">
                <p className="text-muted-text">No RFPs available{activeTab !== "ALL" ? ` with status ${activeTab}` : ""}.</p>
                <p className="text-foreground-dim text-sm mt-2">{t("contractor:rfps.text.rFPsMatchingYourServiceCategoriesWillAppearHere")}</p>
              </div>
            }
            mobileCard={(rfp) => (
              <div className="table-card cursor-pointer" onClick={() => router.push(`/contractor/rfps/${rfp.id}`)}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground text-sm">#{rfp.request?.requestNumber}</span>
                  <div className="flex gap-1">
                    <Badge variant={rfpVariant(rfp.status)} size="sm">{rfp.status}</Badge>
                    {rfp.isInvited && <Badge variant="brand" size="sm">{t("contractor:rfps.text.invited")}</Badge>}
                  </div>
                </div>
                <p className="table-card-sub">{rfp.request?.description ? rfp.request.description.slice(0, 80) : "—"}</p>
                <div className="table-card-footer">
                  <span>{rfp.category || "—"}</span>
                  <span>{rfp.buildingName || "—"}{rfp.unitNumber ? ` / ${rfp.unitNumber}` : ""}</span>
                  <span>{formatDate(rfp.createdAt)}</span>
                </div>
              </div>
            )}
          />
        )}

        <p className="text-xs text-foreground-dim mt-4">Showing {rfps.length} of {total} RFPs</p>
      </div>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","contractor"]);
