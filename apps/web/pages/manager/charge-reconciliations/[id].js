import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import Link from "next/link";
import { authHeaders } from "../../../lib/api";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { useAction } from "../../../lib/hooks/useAction";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { DetailGrid, DetailItem } from "../../../components/ui/DetailGrid";
import ActionBar from "../../../components/ui/ActionBar";
import ResourceShell from "../../../components/ui/ResourceShell";
import { cn } from "../../../lib/utils";
import { reconciliationVariant } from "../../../lib/statusVariants";
import { formatChfCents } from "../../../lib/format";

export default function ChargeReconciliationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: recon, setData: setRecon, loading, error, refresh } = useDetailResource(
    id ? `/api/charge-reconciliations/${id}` : null
  );
  const { pending: saving, run: runSave } = useAction();
  const { pending: actionLoading, run: runAction } = useAction();
  // Local edits for actual costs (lineId → cents string)
  const [editValues, setEditValues] = useState({});

  // Initialize edit values when recon loads
  useEffect(() => {
    if (!recon?.lineItems) return;
    const initEdits = {};
    for (const line of recon.lineItems) {
      initEdits[line.id] = String(line.actualCostCents / 100);
    }
    setEditValues(initEdits);
  }, [recon]);

  const saveLine = (lineId) => {
    const val = parseFloat(editValues[lineId] || "0");
    if (isNaN(val) || val < 0) return;
    const cents = Math.round(val * 100);
    runSave(lineId, async () => {
      const res = await fetch(`/api/charge-reconciliations/${id}/lines/${lineId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ actualCostCents: cents }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save");
      setRecon(json);
    }).catch(e => alert(e.message));
  };

  const handleAction = (action) => {
    runAction(action, async () => {
      const res = await fetch(`/api/charge-reconciliations/${id}/${action}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || `Failed to ${action}`);
      setRecon(json);
      const initEdits = {};
      for (const line of json.lineItems || []) {
        initEdits[line.id] = String(line.actualCostCents / 100);
      }
      setEditValues(initEdits);
    }).catch(e => alert(e.message));
  };

  const handleDelete = () => {
    if (!confirm("Delete this reconciliation?")) return;
    runAction("delete", async () => {
      const res = await fetch(`/api/charge-reconciliations/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Failed to delete");
      }
      router.push("/manager/charge-reconciliations");
    }).catch(e => alert(e.message));
  };

  const isDraft = recon?.status === "DRAFT";
  const isFinalized = recon?.status === "FINALIZED";
  const isSettled = recon?.status === "SETTLED";

  return (
    <AppShell>
      <PageShell>
        <ResourceShell loading={loading} error={error} hasData={!!recon} emptyMessage="Reconciliation not found.">
        {recon && (<>
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
            <DetailGrid>
              <DetailItem label="Tenant">
                <Link href={`/manager/leases/${recon.leaseId}`} className="text-blue-600 hover:underline font-medium">
                  {recon.lease?.tenantName || "—"}
                </Link>
              </DetailItem>
              <DetailItem label="Fiscal Year">{recon.fiscalYear}</DetailItem>
              <DetailItem label="Status">
                <Badge variant={reconciliationVariant(recon.status)} size="sm">
                  {recon.status}
                </Badge>
              </DetailItem>
              <DetailItem label="Balance" valueClassName={cn(recon.balanceCents > 0 ? "text-red-600" : recon.balanceCents < 0 ? "text-green-600" : "")}>
                {recon.balanceCents > 0 ? "+" : ""}{formatChfCents(recon.balanceCents)}
                {recon.balanceCents !== 0 && (
                  <span className="text-xs text-muted-foreground block">
                    {recon.balanceCents > 0 ? "Tenant owes more" : "Credit to tenant"}
                  </span>
                )}
              </DetailItem>
            </DetailGrid>
            {/* Totals */}
            <DetailGrid cols="grid-cols-3" className="mt-4 pt-4 border-t">
              <DetailItem label="Total ACOMPTE Paid">{formatChfCents(recon.totalAcomptePaidCents)}</DetailItem>
              <DetailItem label="Total Actual Costs">{formatChfCents(recon.totalActualCostsCents)}</DetailItem>
              <DetailItem label="Difference">{recon.balanceCents > 0 ? "+" : ""}{formatChfCents(recon.balanceCents)}</DetailItem>
            </DetailGrid>
          </Panel>

          {/* Line Items */}
          <Panel title="Expense Lines" className="mt-6">
            <div className="overflow-x-auto">
              <table className="inline-table">
                <thead>
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
                        <Badge variant={line.chargeMode === "ACOMPTE" ? "info" : "muted"} size="sm">
                          {line.chargeMode}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatChfCents(line.acomptePaidCents)}</td>
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
                          <span className="tabular-nums">{formatChfCents(line.actualCostCents)}</span>
                        )}
                      </td>
                      <td className={cn("py-2 pr-4 text-right tabular-nums", line.balanceCents > 0 ? "text-red-600" : line.balanceCents < 0 ? "text-green-600" : "")}>
                        {line.chargeMode === "ACOMPTE" ? (
                          <>{line.balanceCents > 0 ? "+" : ""}{formatChfCents(line.balanceCents)}</>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {isDraft && (
                        <td className="py-2 text-right">
                          {line.chargeMode === "ACOMPTE" && (
                            <Button
                              variant="primary" size="xs"
                              onClick={() => saveLine(line.id)}
                              disabled={saving === line.id}
                            >
                              {saving === line.id ? "Saving…" : "Save"}
                            </Button>
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
                  <span className="font-medium">{formatChfCents(recon.settlementInvoice.totalAmount)}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Description:</span>
                  <span>{recon.settlementInvoice.description}</span>
                </div>
              </div>
            </Panel>
          )}

          {/* Actions */}
          <ActionBar>
            {isDraft && (
              <>
                <Button
                  variant="warning" size="sm"
                  onClick={() => handleAction("finalize")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "finalize" ? "Finalizing…" : "✓ Finalize"}
                </Button>
                <Button
                  variant="destructive" size="sm"
                  onClick={handleDelete}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "delete" ? "Deleting…" : "🗑 Delete"}
                </Button>
              </>
            )}
            {isFinalized && (
              <>
                <Button
                  variant="success" size="sm"
                  onClick={() => handleAction("settle")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "settle" ? "Generating…" : "💰 Generate Settlement Invoice"}
                </Button>
                <Button
                  variant="secondary" size="sm"
                  onClick={() => handleAction("reopen")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "reopen" ? "Reopening…" : "↩ Reopen for Editing"}
                </Button>
              </>
            )}
          </ActionBar>
        </PageContent>
        </>)}
        </ResourceShell>
      </PageShell>
    </AppShell>
  );
}
