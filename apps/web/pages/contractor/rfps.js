import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import ContractorPicker from "../../components/ContractorPicker";
import { formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "AWARDED", label: "Awarded" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STATUS_COLORS = {
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  AWARDED: "bg-green-50 text-green-700 border-green-200",
  CLOSED: "bg-slate-50 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

const QUOTE_STATUS_COLORS = {
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  AWARDED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-amber-50 text-amber-700 border-amber-200",
};

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
      <div style={{ maxWidth: "1200px" }}>
        <h1 style={{ marginTop: 0, marginBottom: "24px" }}>Available RFPs</h1>

        <ContractorPicker onSelect={() => loadData()} />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
            <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>
              Dismiss
            </button>
          </div>
        )}

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === "ALL" ? rfps.length : rfps.filter((r) => r.status === tab.key).length;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: "0.85em",
                  fontWeight: active ? 700 : 400,
                  border: active ? "2px solid #0b3a75" : "1px solid #ccc",
                  backgroundColor: active ? "#e3f2fd" : "#fff",
                  color: active ? "#0b3a75" : "#333",
                  cursor: "pointer",
                }}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-gray-600">Loading RFPs...</p>
        ) : rfps.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-600">
              No RFPs available{activeTab !== "ALL" ? ` with status ${activeTab}` : ""}.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              RFPs matching your service categories will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[rfp.status] || STATUS_COLORS.OPEN
                        }`}
                      >
                        {rfp.status}
                      </span>
                      {rfp.isInvited && (
                        <span className="ml-1 inline-block rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          Invited
                        </span>
                      )}
                    </td>
                    <td>
                      {rfp.myQuote ? (
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                            QUOTE_STATUS_COLORS[rfp.myQuote.status] || QUOTE_STATUS_COLORS.SUBMITTED
                          }`}
                        >
                          {rfp.myQuote.status === "AWARDED"
                            ? "Won"
                            : rfp.myQuote.status === "REJECTED"
                            ? "Not selected"
                            : "Submitted"}
                        </span>
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

        <p className="text-xs text-gray-400 mt-4">Showing {rfps.length} of {total} RFPs</p>
      </div>
    </AppShell>
  );
}
