import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { fetchWithAuth, postWithAuth } from "../../../lib/api";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { useAction } from "../../../lib/hooks/useAction";
import { formatChfCents, formatDate } from "../../../lib/format";

import { cn } from "../../../lib/utils";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { DetailGrid, DetailItem } from "../../../components/ui/DetailGrid";
import ActionBar from "../../../components/ui/ActionBar";
import ResourceShell from "../../../components/ui/ResourceShell";
import { rentAdjustmentVariant } from "../../../lib/statusVariants";

const TYPE_LABELS = {
  CPI_INDEXATION: "CPI Indexation",
  REFERENCE_RATE_CHANGE: "Reference Rate Change",
  MANUAL: "Manual Adjustment",
};

export default function RentAdjustmentDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: adj, setData: setAdj, loading, error } = useDetailResource(
    id ? `/api/rent-adjustments/${id}` : null
  );
  const { pending: actionLoading, run: runAction } = useAction();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const handleAction = (action) => {
    runAction(async () => {
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
    }).catch(e => alert("Action failed: " + e.message));
  };

  const handleDelete = () => {
    if (!confirm("Delete this rent adjustment?")) return;
    runAction(async () => {
      const res = await fetchWithAuth(`/api/rent-adjustments/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        router.push("/manager/rent-adjustments");
      } else {
        const err = await res.json();
        alert(err.error?.message || "Delete failed");
      }
    }).catch(e => alert("Delete failed: " + e.message));
  };

  const changePct = adj?.previousRentCents
    ? ((adj.adjustmentCents / adj.previousRentCents) * 100).toFixed(2)
    : "—";

  return (
    <AppShell>
      <PageShell>
        <ResourceShell loading={loading} error={error} hasData={!!adj} emptyMessage="Rent adjustment not found.">
        {adj && (<>
        <PageHeader
          title={`Rent Adjustment — ${adj.lease?.tenantName || "Unknown"}`}
          subtitle={`${TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType} · Effective ${formatDate(adj.effectiveDate)}`}
        />
        <PageContent>
          {/* Summary Panel */}
          <Panel title="Summary">
            <DetailGrid>
              <DetailItem label="Status">
                <Badge variant={rentAdjustmentVariant(adj.status)} size="sm">{adj.status}</Badge>
              </DetailItem>
              <DetailItem label="Type">{TYPE_LABELS[adj.adjustmentType]}</DetailItem>
              <DetailItem label="Effective Date">{formatDate(adj.effectiveDate)}</DetailItem>
              <DetailItem label="Lease">
                <a href={`/manager/leases/${adj.leaseId}`} className="cell-link font-medium">
                  {adj.lease?.tenantName}
                </a>
              </DetailItem>
            </DetailGrid>
          </Panel>

          {/* Rent Change Panel */}
          <Panel title="Rent Change" className="mt-4">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <span className="text-slate-500 text-sm block">Previous Rent</span>
                <span className="text-xl font-semibold">{formatChfCents(adj.previousRentCents)}</span>
                <span className="text-xs text-slate-400 block">/month</span>
              </div>
              <div>
                <span className="text-slate-500 text-sm block">→ New Rent</span>
                <span className="text-xl font-bold text-indigo-700">{formatChfCents(adj.newRentCents)}</span>
                <span className="text-xs text-slate-400 block">/month</span>
              </div>
              <div>
                <span className="text-slate-500 text-sm block">Change</span>
                <span className={cn("text-xl font-semibold", adj.adjustmentCents > 0 ? "text-red-600" : adj.adjustmentCents < 0 ? "text-green-600" : "")}>
                  {adj.adjustmentCents > 0 ? "+" : ""}{formatChfCents(adj.adjustmentCents)}
                </span>
                <span className="text-xs text-slate-400 block">({changePct}%)</span>
              </div>
            </div>
          </Panel>

          {/* CPI / Calculation Details */}
          {(adj.cpiOldIndex || adj.cpiNewIndex) && (
            <Panel title="Indexation Details" className="mt-4">
              <DetailGrid>
                <DetailItem label="CPI Base">{adj.cpiOldIndex ?? "—"}</DetailItem>
                <DetailItem label="CPI Current">{adj.cpiNewIndex ?? "—"}</DetailItem>
                {adj.cpiOldIndex && adj.cpiNewIndex && (
                  <DetailItem label="CPI Ratio">{(adj.cpiNewIndex / adj.cpiOldIndex).toFixed(4)}</DetailItem>
                )}
                {adj.referenceRateOld && (
                  <DetailItem label="Ref Rate (old → new)">
                    {adj.referenceRateOld}% → {adj.referenceRateNew || adj.referenceRateOld}%
                  </DetailItem>
                )}
              </DetailGrid>
              {adj.calculationDetails && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-400 cursor-pointer">Calculation breakdown</summary>
                  <pre className="mt-1 text-xs bg-slate-50 rounded p-2 overflow-x-auto">
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
                Rejected on {formatDate(adj.rejectedAt)}
                {adj.rejectionReason && <> — {adj.rejectionReason}</>}
              </p>
            </Panel>
          )}

          {/* Application info */}
          {adj.status === "APPLIED" && (
            <Panel title="Application" className="mt-4">
              <p className="text-green-700 text-sm">
                ✅ Applied on {formatDate(adj.appliedAt)}.
                Lease rent updated to {formatChfCents(adj.newRentCents)}/month.
              </p>
            </Panel>
          )}

          {/* Lease Index Settings */}
          {adj.lease && (
            <Panel title="Lease Index Settings" className="mt-4">
              <DetailGrid>
                <DetailItem label="Index Clause">{adj.lease.indexClauseType || "NONE"}</DetailItem>
                <DetailItem label="CPI Base Index">{adj.lease.cpiBaseIndex ?? "—"}</DetailItem>
                <DetailItem label="Initial Rent">{adj.lease.initialNetRentChf ? fmt(adj.lease.initialNetRentChf * 100) : "—"}</DetailItem>
                <DetailItem label="Last Indexation">
                  {adj.lease.lastIndexationDate
                    ? formatDate(adj.lease.lastIndexationDate)
                    : "Never"}
                </DetailItem>
              </DetailGrid>
            </Panel>
          )}

          {/* Actions */}
          <ActionBar>
            {adj.status === "DRAFT" && (
              <>
                <Button
                  variant="primary" size="sm"
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading}
                >
                  ✓ Approve
                </Button>
                <Button
                  variant="destructiveGhost" size="sm"
                  onClick={() => setShowReject(true)}
                  disabled={actionLoading}
                >
                  ✗ Reject
                </Button>
                <Button
                  variant="secondary" size="sm"
                  onClick={handleDelete}
                  disabled={actionLoading}
                >
                  🗑 Delete
                </Button>
              </>
            )}
            {adj.status === "APPROVED" && (
              <Button
                variant="success" size="sm"
                onClick={() => handleAction("apply")}
                disabled={actionLoading}
              >
                ▶ Apply to Lease
              </Button>
            )}
            <Button
              variant="secondary" size="sm"
              onClick={() => router.push("/manager/rent-adjustments")}
            >
              ← Back to List
            </Button>
          </ActionBar>
          {showReject && (
            <div className="mt-4 p-4 border border-red-200 rounded bg-red-50">
              <label className="block text-sm font-medium text-red-700 mb-1">
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
                <Button
                  variant="destructive" size="xs"
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading}
                >
                  Confirm Reject
                </Button>
                <Button
                  variant="secondary" size="xs"
                  onClick={() => setShowReject(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </PageContent>
        </>)}
        </ResourceShell>
      </PageShell>
    </AppShell>
  );
}
