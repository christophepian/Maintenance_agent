import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { fetchWithAuth, postWithAuth } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  APPLIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const TYPE_LABELS = {
  CPI_INDEXATION: "CPI Indexation",
  REFERENCE_RATE_CHANGE: "Reference Rate Change",
  MANUAL: "Manual Adjustment",
};

export default function RentAdjustmentDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [adj, setAdj] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/rent-adjustments/${id}`);
      if (res.ok) {
        const json = await res.json();
        setAdj(json.data || json);
      }
    } catch (e) {
      console.error("Failed to load rent adjustment:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (cents) => (cents / 100).toLocaleString("de-CH", { style: "currency", currency: "CHF" });

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      const body = action === "reject" ? { reason: rejectReason } : {};
      const res = await postWithAuth(`/api/rent-adjustments/${id}/${action}`, body);
      if (res.ok) {
        const json = await res.json();
        setAdj(json.data || json);
        setShowReject(false);
      } else {
        const err = await res.json();
        alert(err.error?.message || "Action failed");
      }
    } catch (e) {
      alert("Action failed: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this rent adjustment?")) return;
    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/rent-adjustments/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        router.push("/manager/rent-adjustments");
      } else {
        const err = await res.json();
        alert(err.error?.message || "Delete failed");
      }
    } catch (e) {
      alert("Delete failed: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageShell>
          <PageContent><p className="text-gray-500 py-8">Loading…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  if (!adj) {
    return (
      <AppShell>
        <PageShell>
          <PageContent><p className="text-red-600 py-8">Rent adjustment not found.</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }

  const changePct = adj.previousRentCents
    ? ((adj.adjustmentCents / adj.previousRentCents) * 100).toFixed(2)
    : "—";

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title={`Rent Adjustment — ${adj.lease?.tenantName || "Unknown"}`}
          subtitle={`${TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType} · Effective ${new Date(adj.effectiveDate).toLocaleDateString("de-CH")}`}
        />
        <PageContent>
          {/* Summary Panel */}
          <Panel title="Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block">Status</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mt-1 ${STATUS_COLORS[adj.status]}`}>
                  {adj.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Type</span>
                <span className="font-medium">{TYPE_LABELS[adj.adjustmentType]}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Effective Date</span>
                <span className="font-medium">{new Date(adj.effectiveDate).toLocaleDateString("de-CH")}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Lease</span>
                <a href={`/manager/leases/${adj.leaseId}`} className="text-indigo-600 hover:underline font-medium">
                  {adj.lease?.tenantName}
                </a>
              </div>
            </div>
          </Panel>

          {/* Rent Change Panel */}
          <Panel title="Rent Change" className="mt-4">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <span className="text-gray-500 text-sm block">Previous Rent</span>
                <span className="text-xl font-semibold">{fmt(adj.previousRentCents)}</span>
                <span className="text-xs text-gray-400 block">/month</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm block">→ New Rent</span>
                <span className="text-xl font-bold text-indigo-700">{fmt(adj.newRentCents)}</span>
                <span className="text-xs text-gray-400 block">/month</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm block">Change</span>
                <span className={`text-xl font-semibold ${adj.adjustmentCents > 0 ? "text-red-600" : adj.adjustmentCents < 0 ? "text-green-600" : ""}`}>
                  {adj.adjustmentCents > 0 ? "+" : ""}{fmt(adj.adjustmentCents)}
                </span>
                <span className="text-xs text-gray-400 block">({changePct}%)</span>
              </div>
            </div>
          </Panel>

          {/* CPI / Calculation Details */}
          {(adj.cpiOldIndex || adj.cpiNewIndex) && (
            <Panel title="Indexation Details" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block">CPI Base</span>
                  <span className="font-medium">{adj.cpiOldIndex ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">CPI Current</span>
                  <span className="font-medium">{adj.cpiNewIndex ?? "—"}</span>
                </div>
                {adj.cpiOldIndex && adj.cpiNewIndex && (
                  <div>
                    <span className="text-gray-500 block">CPI Ratio</span>
                    <span className="font-medium">{(adj.cpiNewIndex / adj.cpiOldIndex).toFixed(4)}</span>
                  </div>
                )}
                {adj.referenceRateOld && (
                  <div>
                    <span className="text-gray-500 block">Ref Rate (old → new)</span>
                    <span className="font-medium">
                      {adj.referenceRateOld}% → {adj.referenceRateNew || adj.referenceRateOld}%
                    </span>
                  </div>
                )}
              </div>
              {adj.calculationDetails && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer">Calculation breakdown</summary>
                  <pre className="mt-1 text-xs bg-gray-50 rounded p-2 overflow-x-auto">
                    {JSON.stringify(adj.calculationDetails, null, 2)}
                  </pre>
                </details>
              )}
            </Panel>
          )}

          {/* Rejection info */}
          {adj.status === "REJECTED" && (
            <Panel title="Rejection" className="mt-4">
              <p className="text-red-600 text-sm">
                Rejected on {adj.rejectedAt ? new Date(adj.rejectedAt).toLocaleDateString("de-CH") : "—"}
                {adj.rejectionReason && <> — {adj.rejectionReason}</>}
              </p>
            </Panel>
          )}

          {/* Application info */}
          {adj.status === "APPLIED" && (
            <Panel title="Application" className="mt-4">
              <p className="text-green-700 text-sm">
                ✅ Applied on {adj.appliedAt ? new Date(adj.appliedAt).toLocaleDateString("de-CH") : "—"}.
                Lease rent updated to {fmt(adj.newRentCents)}/month.
              </p>
            </Panel>
          )}

          {/* Lease Index Settings */}
          {adj.lease && (
            <Panel title="Lease Index Settings" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block">Index Clause</span>
                  <span className="font-medium">{adj.lease.indexClauseType || "NONE"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">CPI Base Index</span>
                  <span className="font-medium">{adj.lease.cpiBaseIndex ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Initial Rent</span>
                  <span className="font-medium">{adj.lease.initialNetRentChf ? fmt(adj.lease.initialNetRentChf * 100) : "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Last Indexation</span>
                  <span className="font-medium">
                    {adj.lease.lastIndexationDate
                      ? new Date(adj.lease.lastIndexationDate).toLocaleDateString("de-CH")
                      : "Never"}
                  </span>
                </div>
              </div>
            </Panel>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3 flex-wrap">
            {adj.status === "DRAFT" && (
              <>
                <button
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                >
                  ✗ Reject
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  🗑 Delete
                </button>
              </>
            )}
            {adj.status === "APPROVED" && (
              <button
                onClick={() => handleAction("apply")}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                ▶ Apply to Lease
              </button>
            )}
            <button
              onClick={() => router.push("/manager/rent-adjustments")}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              ← Back to List
            </button>
          </div>

          {/* Reject modal */}
          {showReject && (
            <div className="mt-4 p-4 border border-red-200 rounded bg-red-50">
              <label className="block text-sm font-medium text-red-800 mb-1">
                Rejection reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                rows={2}
                placeholder="Enter reason…"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
