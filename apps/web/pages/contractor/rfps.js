import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import ContractorPicker from "../../components/ContractorPicker";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { rfpVariant, quoteVariant } from "../../lib/statusVariants";
import { formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "AWARDED", label: "Awarded" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function ContractorRfpsPage() {
  const [rfps, setRfps] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");

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
        ) : rfps.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded p-8 text-center">
            <p className="text-slate-600">
              No RFPs available{activeTab !== "ALL" ? ` with status ${activeTab}` : ""}.
            </p>
            <p className="text-slate-400 text-sm mt-2">
              RFPs matching your service categories will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="inline-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>My Quote</th>
                  <th>Invited</th>
                  <th>Quotes</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rfps.map((rfp) => (
                  <tr key={rfp.id}>
                    <td>
                      {rfp.request ? (
                        <span className="text-sm">
                          <span className="font-medium text-slate-900">
                            #{rfp.request.requestNumber}
                          </span>
                          <span className="block text-xs text-slate-500 max-w-[200px] truncate">
                            {rfp.request.description}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-sm text-slate-700">{rfp.category || "—"}</td>
                    <td className="text-sm text-slate-700">
                      {rfp.buildingName || "—"}
                      {rfp.postalCode && (
                        <span className="text-slate-400 text-xs ml-1">({rfp.postalCode})</span>
                      )}
                      {rfp.unitNumber && (
                        <span className="text-slate-400"> / {rfp.unitNumber}</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={rfpVariant(rfp.status)} size="sm">
                        {rfp.status}
                      </Badge>
                      {rfp.isInvited && (
                        <Badge variant="brand" size="sm" className="ml-1">
                          Invited
                        </Badge>
                      )}
                    </td>
                    <td>
                      {rfp.myQuote ? (
                        <Badge variant={quoteVariant(rfp.myQuote.status)} size="sm">
                          {rfp.myQuote.status === "AWARDED"
                            ? "Won"
                            : rfp.myQuote.status === "REJECTED"
                            ? "Not selected"
                            : "Submitted"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-center text-sm text-slate-700">{rfp.inviteCount}</td>
                    <td className="text-center text-sm text-slate-700">
                      <span className={rfp.quoteCount > 0 ? "font-medium text-green-700" : ""}>
                        {rfp.quoteCount}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">{formatDate(rfp.createdAt)}</td>
                    <td>
                      <Link
                        href={`/contractor/rfps/${rfp.id}`}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4">Showing {rfps.length} of {total} RFPs</p>
      </div>
    </AppShell>
  );
}
