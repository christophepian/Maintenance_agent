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

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "AWARDED", label: "Awarded" },
  { key: "CANCELLED", label: "Cancelled" },
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

const CRFP_COLUMNS = [
  {
    id: "request",
    label: "Request",
    alwaysVisible: true,
    render: (rfp) => rfp.request ? (
      <span className="text-sm">
        <span className="font-medium text-slate-900">#{rfp.request.requestNumber}</span>
        <span className="block text-xs text-slate-500 max-w-[200px] truncate">{rfp.request.description}</span>
      </span>
    ) : <span className="text-xs text-slate-400">\u2014</span>,
  },
  {
    id: "category",
    label: "Category",
    sortable: true,
    defaultVisible: true,
    render: (rfp) => <span className="text-sm text-slate-700">{rfp.category || "\u2014"}</span>,
  },
  {
    id: "location",
    label: "Location",
    defaultVisible: true,
    render: (rfp) => (
      <span className="text-sm text-slate-700">
        {rfp.buildingName || "\u2014"}
        {rfp.postalCode && <span className="text-slate-400 text-xs ml-1">({rfp.postalCode})</span>}
        {rfp.unitNumber && <span className="text-slate-400"> / {rfp.unitNumber}</span>}
      </span>
    ),
  },
  {
    id: "status",
    label: "Status",
    sortable: true,
    defaultVisible: true,
    render: (rfp) => (
      <>
        <Badge variant={rfpVariant(rfp.status)} size="sm">{rfp.status}</Badge>
        {rfp.isInvited && <Badge variant="brand" size="sm" className="ml-1">Invited</Badge>}
      </>
    ),
  },
  {
    id: "myQuote",
    label: "My Quote",
    defaultVisible: true,
    render: (rfp) => rfp.myQuote ? (
      <Badge variant={quoteVariant(rfp.myQuote.status)} size="sm">
        {rfp.myQuote.status === "AWARDED" ? "Won" : rfp.myQuote.status === "REJECTED" ? "Not selected" : "Submitted"}
      </Badge>
    ) : <span className="text-xs text-slate-400">\u2014</span>,
  },
  {
    id: "invites",
    label: "Invited",
    sortable: true,
    defaultVisible: true,
    className: "text-center",
    render: (rfp) => <span className="text-sm text-slate-700">{rfp.inviteCount}</span>,
  },
  {
    id: "quotes",
    label: "Quotes",
    sortable: true,
    defaultVisible: true,
    className: "text-center",
    render: (rfp) => <span className={rfp.quoteCount > 0 ? "font-medium text-green-700 text-sm" : "text-sm text-slate-700"}>{rfp.quoteCount}</span>,
  },
  {
    id: "createdAt",
    label: "Created",
    sortable: true,
    defaultVisible: true,
    render: (rfp) => <span className="text-sm text-slate-500">{formatDate(rfp.createdAt)}</span>,
  },
  {
    id: "view",
    label: "",
    alwaysVisible: true,
    render: (rfp) => (
      <Link href={`/contractor/rfps/${rfp.id}`} className="cell-link text-xs font-medium" onClick={(e) => e.stopPropagation()}>View</Link>
    ),
  },
];

export default function ContractorRfpsPage() {
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
        <h1 className="mt-0 mb-6">Available RFPs</h1>

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
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-slate-600">Loading RFPs...</p>
        ) : (
          <ConfigurableTable
            tableId="contractor-rfps"
            columns={CRFP_COLUMNS}
            data={sortedRfps}
            rowKey={(rfp) => rfp.id}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(rfp) => router.push(`/contractor/rfps/${rfp.id}`)}
            emptyState={
              <div className="bg-slate-50 border border-slate-200 rounded p-8 text-center">
                <p className="text-slate-600">No RFPs available{activeTab !== "ALL" ? ` with status ${activeTab}` : ""}.</p>
                <p className="text-slate-400 text-sm mt-2">RFPs matching your service categories will appear here.</p>
              </div>
            }
          />
        )}

        <p className="text-xs text-slate-400 mt-4">Showing {rfps.length} of {total} RFPs</p>
      </div>
    </AppShell>
  );
}
