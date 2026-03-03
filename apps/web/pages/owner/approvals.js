import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";

export default function OwnerApprovalsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);

  function authHeaders() {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  async function loadPendingApprovals() {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/approvals", { headers: authHeaders() });
      const json = await res.json();
      setRequests(json.data || []);
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(requestId) {
    if (!confirm("Approve this maintenance request?")) return;

    setActionInProgress(requestId);
    try {
      const res = await fetch(`/api/owner/approvals?id=${requestId}&action=approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ comment: "Approved by owner" }),
      });

      if (res.ok) {
        await loadPendingApprovals();
      } else {
        const json = await res.json();
        alert(`Failed to approve: ${json.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Approve failed:", err);
      alert("Failed to approve request");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(requestId) {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return; // User cancelled

    setActionInProgress(requestId);
    try {
      const res = await fetch(`/api/owner/approvals?id=${requestId}&action=reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        await loadPendingApprovals();
      } else {
        const json = await res.json();
        alert(`Failed to reject: ${json.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Reject failed:", err);
      alert("Failed to reject request");
    } finally {
      setActionInProgress(null);
    }
  }

  function formatCost(cost) {
    if (!cost) return "—";
    const str = Number(cost).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return `CHF ${str}`;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader title="Pending Owner Approvals" />

        <PageContent>
          {loading && <div className="text-slate-600">Loading...</div>}

          {!loading && requests.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              No requests pending your approval
            </div>
          )}

          {!loading && requests.length > 0 && (
            <div className="space-y-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
                >
                  {/* Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {req.category || "General Maintenance"}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Submitted {formatDate(req.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      Pending Owner Approval
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mb-4 space-y-2">
                    <div>
                      <span className="text-sm font-medium text-slate-700">Description:</span>
                      <p className="text-sm text-slate-600">{req.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">Estimated Cost:</span>{" "}
                        <span className="text-slate-900">{formatCost(req.estimatedCost)}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Building:</span>{" "}
                        <span className="text-slate-900">{req.unit?.building?.name || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Unit:</span>{" "}
                        <span className="text-slate-900">{req.unit?.unitNumber || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Tenant:</span>{" "}
                        <span className="text-slate-900">{req.tenant?.name || "—"}</span>
                      </div>
                    </div>

                    {req.appliance && (
                      <div className="text-sm">
                        <span className="font-medium text-slate-700">Appliance:</span>{" "}
                        <span className="text-slate-900">
                          {req.appliance.assetModel
                            ? `${req.appliance.assetModel.manufacturer} ${req.appliance.assetModel.model} (${req.appliance.assetModel.category})`
                            : req.appliance.name || "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionInProgress === req.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {actionInProgress === req.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actionInProgress === req.id}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {actionInProgress === req.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
