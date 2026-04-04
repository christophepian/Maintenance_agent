import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-blue-100 text-blue-800",
  FINALIZED: "bg-amber-100 text-amber-800",
  SETTLED: "bg-emerald-100 text-emerald-800",
};

export default function ChargeReconciliationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [recon, setRecon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // lineId being saved
  const [actionLoading, setActionLoading] = useState(null);
  // Local edits for actual costs (lineId → cents string)
  const [editValues, setEditValues] = useState({});

  const fetchRecon = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/charge-reconciliations/${id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load");
      setRecon(json);
      // Init edit values from existing data
      const initEdits = {};
      for (const line of json.lineItems || []) {
        initEdits[line.id] = String(line.actualCostCents / 100);
      }
      setEditValues(initEdits);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRecon(); }, [fetchRecon]);

  const saveLine = async (lineId) => {
    const val = parseFloat(editValues[lineId] || "0");
    if (isNaN(val) || val < 0) return;
    const cents = Math.round(val * 100);
    setSaving(lineId);
    try {
      const res = await fetch(`/api/charge-reconciliations/${id}/lines/${lineId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ actualCostCents: cents }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save");
      setRecon(json);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/charge-reconciliations/${id}/${action}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || `Failed to ${action}`);
      setRecon(json);
      // Refresh edit values after status change
      const initEdits = {};
      for (const line of json.lineItems || []) {
        initEdits[line.id] = String(line.actualCostCents / 100);
      }
      setEditValues(initEdits);
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this reconciliation?")) return;
    setActionLoading("delete");
    try {
      const res = await fetch(`/api/charge-reconciliations/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Failed to delete");
      }
      router.push("/manager/charge-reconciliations");
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const fmt = (cents) => (cents / 100).toFixed(2);

  if (!router.isReady || loading) {
    return (
      <AppShell>
        <PageShell>
          <PageContent><p className="text-sm text-muted-foreground">Loading…</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell>
        <PageShell>
          <PageContent><p className="text-sm text-destructive">{error}</p></PageContent>
        </PageShell>
      </AppShell>
    );
  }
  if (!recon) return null;

  const isDraft = recon.status === "DRAFT";
  const isFinalized = recon.status === "FINALIZED";
  const isSettled = recon.status === "SETTLED";

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title={`Charge Reconciliation — ${recon.fiscalYear}`}
          breadcrumbs={[
            { label: "Charge Reconciliations", href: "/manager/charge-reconciliations" },
            { label: recon.lease?.tenantName || recon.leaseId },
          ]}
        />
        <PageContent>
          {/* Summary */}
          <Panel title="Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Tenant</span>
                <Link href={`/manager/leases/${recon.leaseId}`} className="text-blue-600 hover:underline font-medium">
                  {recon.lease?.tenantName || "—"}
                </Link>
              </div>
              <div>
                <span className="text-muted-foreground block">Fiscal Year</span>
                <span className="font-medium">{recon.fiscalYear}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Status</span>
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[recon.status] || "bg-gray-100"}`}>
                  {recon.status}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Balance</span>
                <span className={`font-medium ${recon.balanceCents > 0 ? "text-red-600" : recon.balanceCents < 0 ? "text-emerald-600" : ""}`}>
                  {recon.balanceCents > 0 ? "+" : ""}{fmt(recon.balanceCents)} CHF
                </span>
                {recon.balanceCents !== 0 && (
                  <span className="text-xs text-muted-foreground block">
                    {recon.balanceCents > 0 ? "Tenant owes more" : "Credit to tenant"}
                  </span>
                )}
              </div>
            </div>
            {/* Totals */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t text-sm">
              <div>
                <span className="text-muted-foreground block">Total ACOMPTE Paid</span>
                <span className="font-medium">{fmt(recon.totalAcomptePaidCents)} CHF</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Total Actual Costs</span>
                <span className="font-medium">{fmt(recon.totalActualCostsCents)} CHF</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Difference</span>
                <span className="font-medium">{recon.balanceCents > 0 ? "+" : ""}{fmt(recon.balanceCents)} CHF</span>
              </div>
            </div>
          </Panel>

          {/* Line Items */}
          <Panel title="Expense Lines" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="py-2 pr-4">Expense</th>
                    <th className="py-2 pr-4">Mode</th>
                    <th className="py-2 pr-4 text-right">ACOMPTE Paid</th>
                    <th className="py-2 pr-4 text-right">Actual Cost</th>
                    <th className="py-2 pr-4 text-right">Balance</th>
                    {isDraft && <th className="py-2 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {recon.lineItems.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{line.description}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          line.chargeMode === "ACOMPTE" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {line.chargeMode}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmt(line.acomptePaidCents)}</td>
                      <td className="py-2 pr-4 text-right">
                        {isDraft && line.chargeMode === "ACOMPTE" ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28 text-right border rounded px-2 py-1 text-sm"
                            value={editValues[line.id] || ""}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveLine(line.id);
                            }}
                          />
                        ) : (
                          <span className="tabular-nums">{fmt(line.actualCostCents)}</span>
                        )}
                      </td>
                      <td className={`py-2 pr-4 text-right tabular-nums ${
                        line.balanceCents > 0 ? "text-red-600" : line.balanceCents < 0 ? "text-emerald-600" : ""
                      }`}>
                        {line.chargeMode === "ACOMPTE" ? (
                          <>{line.balanceCents > 0 ? "+" : ""}{fmt(line.balanceCents)}</>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {isDraft && (
                        <td className="py-2 text-right">
                          {line.chargeMode === "ACOMPTE" && (
                            <button
                              onClick={() => saveLine(line.id)}
                              disabled={saving === line.id}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {saving === line.id ? "Saving…" : "Save"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Settlement Invoice */}
          {isSettled && recon.settlementInvoice && (
            <Panel title="Settlement Invoice" className="mt-6">
              <div className="text-sm space-y-2">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Invoice:</span>
                  <Link href={`/manager/finance/invoices/${recon.settlementInvoice.id}`} className="text-blue-600 hover:underline">
                    {recon.settlementInvoice.invoiceNumber || recon.settlementInvoice.id.slice(0, 8)}
                  </Link>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Status:</span>
                  <span>{recon.settlementInvoice.status}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">{(recon.settlementInvoice.totalAmount / 100).toFixed(2)} CHF</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Description:</span>
                  <span>{recon.settlementInvoice.description}</span>
                </div>
              </div>
            </Panel>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            {isDraft && (
              <>
                <button
                  onClick={() => handleAction("finalize")}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading === "finalize" ? "Finalizing…" : "✓ Finalize"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading === "delete" ? "Deleting…" : "🗑 Delete"}
                </button>
              </>
            )}
            {isFinalized && (
              <>
                <button
                  onClick={() => handleAction("settle")}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading === "settle" ? "Generating…" : "💰 Generate Settlement Invoice"}
                </button>
                <button
                  onClick={() => handleAction("reopen")}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading === "reopen" ? "Reopening…" : "↩ Reopen for Editing"}
                </button>
              </>
            )}
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
