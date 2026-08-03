import { useState, useEffect, useMemo } from "react";
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
import SortableHeader from "../../../components/SortableHeader";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";

export default function ChargeReconciliationDetailPage() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;
  const { data: recon, setData: setRecon, loading, error, refresh } = useDetailResource(
    id ? `/api/charge-reconciliations/${id}` : null
  );
  const { pending: saving, run: runSave } = useAction();
  const { pending: actionLoading, run: runAction } = useAction();
  // Local edits for actual costs (lineId → cents string)
  const [editValues, setEditValues] = useState({});

  const { sortField: liSF, sortDir: liSD, handleSort: handleLineSort } = useLocalSort("description", "asc");
  const sortedLineItems = useMemo(() => {
    const items = recon?.lineItems || [];
    return [...items].sort((a, b) => {
      let va = "", vb = "";
      if (liSF === "mode") { va = a.chargeMode || ""; vb = b.chargeMode || ""; }
      else if (liSF === "acompte") return liSD === "asc" ? (a.acomptePaidCents ?? 0) - (b.acomptePaidCents ?? 0) : (b.acomptePaidCents ?? 0) - (a.acomptePaidCents ?? 0);
      else if (liSF === "actual") return liSD === "asc" ? (a.actualCostCents ?? 0) - (b.actualCostCents ?? 0) : (b.actualCostCents ?? 0) - (a.actualCostCents ?? 0);
      else if (liSF === "balance") return liSD === "asc" ? (a.balanceCents ?? 0) - (b.balanceCents ?? 0) : (b.balanceCents ?? 0) - (a.balanceCents ?? 0);
      else { va = (a.description || "").toLowerCase(); vb = (b.description || "").toLowerCase(); }
      return liSD === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [recon, liSF, liSD]);

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

  // ── F2: cost-pool auto-fill + inspection rights ──
  const [periods, setPeriods] = useState([]);
  const [selPeriod, setSelPeriod] = useState("");
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [docRequests, setDocRequests] = useState([]);

  useEffect(() => {
    if (recon?.status !== "DRAFT") return;
    fetch("/api/billing-periods", { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setPeriods(j.data || []))
      .catch(() => {});
  }, [recon?.status]);

  useEffect(() => {
    if (!id || recon?.status !== "SETTLED") return;
    Promise.all([
      fetch(`/api/charge-reconciliations/${id}/supporting-documents`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/charge-reconciliations/${id}/doc-requests`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([s, d]) => { setSupportingDocs(s.data || []); setDocRequests(d.data || []); });
  }, [id, recon?.status]);

  const handleAutofill = () => {
    if (!selPeriod) return;
    runAction("autofill", async () => {
      const res = await fetch(`/api/charge-reconciliations/${id}/autofill`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ billingPeriodId: selPeriod }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to auto-fill");
      setRecon(json);
      const initEdits = {};
      for (const line of json.lineItems || []) initEdits[line.id] = String(line.actualCostCents / 100);
      setEditValues(initEdits);
    }).catch((e) => alert(e.message));
  };

  const refreshDocRequests = async () => {
    const d = await fetch(`/api/charge-reconciliations/${id}/doc-requests`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({ data: [] }));
    setDocRequests(d.data || []);
  };
  const createDocReq = () => {
    runAction("docreq", async () => {
      const res = await fetch(`/api/charge-reconciliations/${id}/doc-requests`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      await refreshDocRequests();
    }).catch((e) => alert(e.message));
  };
  const fulfillDocReq = (rid) => {
    runAction("fulfill-" + rid, async () => {
      const res = await fetch(`/api/charge-reconciliations/${id}/doc-requests/${rid}/fulfill`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed");
      await refreshDocRequests();
    }).catch((e) => alert(e.message));
  };

  const isDraft = recon?.status === "DRAFT";
  const isFinalized = recon?.status === "FINALIZED";
  const isSettled = recon?.status === "SETTLED";

  return (
    <AppShell>
      <PageShell>
        <ResourceShell loading={loading} error={error} hasData={!!recon} emptyMessage={t("manager:charge_ReconciliationsId.prop.reconciliationNotFound")}>
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
          <Panel title={t("manager:chargeReconciliationsId.title.summary")}>
            <DetailGrid>
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.tenant")}>
                <Link href={`/manager/leases/${recon.leaseId}`} className="text-blue-600 hover:underline font-medium">
                  {recon.lease?.tenantName || "—"}
                </Link>
              </DetailItem>
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.fiscalYear")}>{recon.fiscalYear}</DetailItem>
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.status")}>
                <Badge variant={reconciliationVariant(recon.status)} size="sm">
                  {recon.status}
                </Badge>
              </DetailItem>
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.balance")} valueClassName={cn(recon.balanceCents > 0 ? "text-red-600" : recon.balanceCents < 0 ? "text-green-600" : "")}>
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
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.totalAcomptePaid")}>{formatChfCents(recon.totalAcomptePaidCents)}</DetailItem>
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.totalActualCosts")}>{formatChfCents(recon.totalActualCostsCents)}</DetailItem>
              <DetailItem label={t("manager:charge_ReconciliationsId.prop.difference")}>{recon.balanceCents > 0 ? "+" : ""}{formatChfCents(recon.balanceCents)}</DetailItem>
              {recon.adminFeeCents > 0 && (
                <DetailItem label={t("costPool.field.adminFee")}>{formatChfCents(recon.adminFeeCents)}</DetailItem>
              )}
            </DetailGrid>
          </Panel>

          {/* Line Items */}
          <Panel
            title={t("manager:chargeReconciliationsId.title.expenseLines")}
            className="mt-6"
            actions={isDraft && periods.length > 0 ? (
              <div className="flex items-center gap-2">
                <select
                  className="border border-surface-border rounded-lg px-2 py-1 text-xs bg-surface max-w-[220px]"
                  value={selPeriod}
                  onChange={(e) => setSelPeriod(e.target.value)}
                >
                  <option value="">{t("costPool.text.selectPeriod")}</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.buildingName} · {p.startDate?.slice(0, 10)}–{p.endDate?.slice(0, 10)}</option>
                  ))}
                </select>
                <Button variant="secondary" size="xs" onClick={handleAutofill} disabled={!selPeriod || actionLoading === "autofill"}>
                  {actionLoading === "autofill" ? "…" : t("costPool.action.autofill")}
                </Button>
              </div>
            ) : null}
          >
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {sortedLineItems.map((line) => (
                <div key={line.id} className="py-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{line.description}</span>
                    <Badge variant={line.chargeMode === "ACOMPTE" ? "info" : "muted"} size="sm">
                      {line.chargeMode}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>ACOMPTE: {formatChfCents(line.acomptePaidCents)}</span>
                    <span>
                      Actual:{" "}
                      {isDraft && line.chargeMode === "ACOMPTE" ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 text-right border rounded px-2 py-0.5 text-xs"
                          value={editValues[line.id] || ""}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveLine(line.id); }}
                        />
                      ) : (
                        formatChfCents(line.actualCostCents)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn("tabular-nums", line.balanceCents > 0 ? "text-red-600" : line.balanceCents < 0 ? "text-green-600" : "text-muted")}>
                      Balance:{" "}
                      {line.chargeMode === "ACOMPTE"
                        ? <>{line.balanceCents > 0 ? "+" : ""}{formatChfCents(line.balanceCents)}</>
                        : "—"}
                    </span>
                    {isDraft && line.chargeMode === "ACOMPTE" && (
                      <Button variant="primary" size="xs" onClick={() => saveLine(line.id)} disabled={saving === line.id}>
                        {saving === line.id ? "Saving…" : "Save"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label={t("manager:charge_ReconciliationsId.prop.expense")} field="description" sortField={liSF} sortDir={liSD} onSort={handleLineSort} />
                    <SortableHeader label={t("manager:charge_ReconciliationsId.prop.mode")} field="mode" sortField={liSF} sortDir={liSD} onSort={handleLineSort} />
                    <SortableHeader label={t("manager:charge_ReconciliationsId.prop.aCOMPTEPaid")} field="acompte" sortField={liSF} sortDir={liSD} onSort={handleLineSort} className="text-right" />
                    <SortableHeader label={t("manager:charge_ReconciliationsId.prop.actualCost")} field="actual" sortField={liSF} sortDir={liSD} onSort={handleLineSort} className="text-right" />
                    <SortableHeader label={t("manager:charge_ReconciliationsId.prop.balance")} field="balance" sortField={liSF} sortDir={liSD} onSort={handleLineSort} className="text-right" />
                    {isDraft && <th className="text-right">{t("manager:chargeReconciliationsId.col.action")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedLineItems.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="font-medium">{line.description}</td>
                      <td>
                        <Badge variant={line.chargeMode === "ACOMPTE" ? "info" : "muted"} size="sm">
                          {line.chargeMode}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums">{formatChfCents(line.acomptePaidCents)}</td>
                      <td className="text-right">
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
                      <td className={cn("text-right tabular-nums", line.balanceCents > 0 ? "text-red-600" : line.balanceCents < 0 ? "text-green-600" : "")}>
                        {line.chargeMode === "ACOMPTE" ? (
                          <>{line.balanceCents > 0 ? "+" : ""}{formatChfCents(line.balanceCents)}</>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {isDraft && (
                        <td className="text-right">
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
            <Panel title={t("manager:chargeReconciliationsId.title.settlementInvoice")} className="mt-6">
              <div className="text-sm space-y-2">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{t("manager:charge_ReconciliationsId.text.invoice")}</span>
                  <Link href={`/manager/finance/invoices/${recon.settlementInvoice.id}`} className="text-blue-600 hover:underline">
                    {recon.settlementInvoice.invoiceNumber || recon.settlementInvoice.id.slice(0, 8)}
                  </Link>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{t("manager:charge_ReconciliationsId.text.status")}</span>
                  <span>{recon.settlementInvoice.status}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{t("manager:charge_ReconciliationsId.text.amount")}</span>
                  <span className="font-medium">{formatChfCents(recon.settlementInvoice.totalAmount)}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{t("manager:charge_ReconciliationsId.text.description")}</span>
                  <span>{recon.settlementInvoice.description}</span>
                </div>
              </div>
            </Panel>
          )}

          {/* Refund credit note */}
          {isSettled && recon.settlementCreditNoteId && (
            <Panel title={t("costPool.title.creditNote")} className="mt-6">
              <p className="text-sm text-green-700">{t("costPool.text.refundIssued")}</p>
            </Panel>
          )}

          {/* Inspection rights */}
          {isSettled && (
            <Panel title={t("costPool.title.inspection")} className="mt-6">
              {recon.inspectionDeadline && (
                <p className="text-sm text-muted-text mb-4">{t("costPool.text.inspectionUntil", { date: recon.inspectionDeadline.slice(0, 10) })}</p>
              )}

              <h3 className="text-sm font-semibold text-foreground mb-2">{t("costPool.title.supportingDocs")}</h3>
              {supportingDocs.length === 0 ? (
                <p className="text-xs text-muted-text italic mb-4">{t("costPool.text.noSupportingDocs")}</p>
              ) : (
                <div className="overflow-x-auto mb-4">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>{t("costPool.col.category")}</th>
                        <th className="text-right">{t("costPool.col.amount")}</th>
                        <th>{t("costPool.col.sourceInvoice")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportingDocs.map((d, i) => (
                        <tr key={i} className="border-t border-surface-divider">
                          <td>{d.categoryName}</td>
                          <td className="text-right tabular-nums">{formatChfCents(d.amountCents)}</td>
                          <td className="text-xs text-muted-text">{d.sourceInvoiceId ? d.sourceInvoiceId.slice(0, 8) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{t("costPool.title.docRequests")}</h3>
                <Button variant="secondary" size="xs" onClick={createDocReq} disabled={!!actionLoading}>{t("costPool.action.logDocRequest")}</Button>
              </div>
              {docRequests.length === 0 ? (
                <p className="text-xs text-muted-text italic">{t("costPool.text.noDocRequests")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {docRequests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{r.requestedAt?.slice(0, 10)}{r.note ? ` — ${r.note}` : ""}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge variant={r.status === "FULFILLED" ? "success" : "warning"} size="sm">{r.status}</Badge>
                        {r.status === "OPEN" && (
                          <Button variant="primary" size="xs" onClick={() => fulfillDocReq(r.id)} disabled={!!actionLoading}>{t("costPool.action.fulfill")}</Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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

export const getServerSideProps = withServerTranslations(["common","manager"]);
