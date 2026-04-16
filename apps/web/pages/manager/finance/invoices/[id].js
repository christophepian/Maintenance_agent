import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Badge from "../../../../components/ui/Badge";
import { invoiceVariant, ingestionVariant } from "../../../../lib/statusVariants";
import { authHeaders } from "../../../../lib/api";

/* ─── Helpers ─────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatChf(amount) {
  if (typeof amount !== "number") return "—";
  const [intPart, decPart] = amount.toFixed(2).split(".");
  return `CHF ${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${decPart}`;
}

/* ─── Badge components ────────────────────────────────────── */

function StatusBadge({ status }) {
  return (
    <Badge variant={invoiceVariant(status)} size="sm">
      {status}
    </Badge>
  );
}

const INGESTION_LABEL = {
  PENDING_REVIEW: "Needs review",
  AUTO_CONFIRMED: "Auto-confirmed",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

function IngestionBadge({ ingestionStatus }) {
  if (!ingestionStatus) return null;
  return (
    <Badge variant={ingestionVariant(ingestionStatus)} size="sm" className="ml-2">
      {INGESTION_LABEL[ingestionStatus] || ingestionStatus}
    </Badge>
  );
}

const SOURCE_LABEL = {
  BROWSER_UPLOAD: { text: "Upload", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  EMAIL_PDF: { text: "Email", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  MOBILE_CAPTURE: { text: "Mobile", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  MANUAL: { text: "Manual", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

/* ─── Detail field row ────────────────────────────────────── */

function Field({ label, value, className }) {
  return (
    <div className={className || ""}>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [billingEntities, setBillingEntities] = useState([]);
  const [selectedBillingEntityId, setSelectedBillingEntityId] = useState("");
  const [showCreateBE, setShowCreateBE] = useState(false);
  const [beForm, setBeForm] = useState({ name: "", addressLine1: "", postalCode: "", city: "", iban: "", vatNumber: "", defaultVatRate: "7.7" });
  const [beSaving, setBeSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load invoice");
      setInvoice(data?.data || null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load billing entities
  useEffect(() => {
    fetch("/api/billing-entities", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.data) setBillingEntities(d.data);
      })
      .catch(() => {});
  }, []);

  // Sync selected billing entity when invoice loads
  useEffect(() => {
    if (invoice?.issuerBillingEntityId) {
      setSelectedBillingEntityId(invoice.issuerBillingEntityId);
    }
  }, [invoice?.issuerBillingEntityId]);

  // Load PDF preview
  useEffect(() => {
    if (!id) return;
    fetch(`/api/invoices/${id}/pdf`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) return null;
        return r.blob();
      })
      .then((blob) => {
        if (blob) setPdfUrl(URL.createObjectURL(blob));
      })
      .catch(() => {});
    return () => {
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [id]);

  async function invoiceAction(action, body) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || `Failed to ${action}`);
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  async function saveBillingEntity(billingEntityId) {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ issuerBillingEntityId: billingEntityId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to link billing entity");
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function createAndLinkBE() {
    setBeSaving(true);
    try {
      const res = await fetch("/api/billing-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          type: "ORG",
          name: beForm.name,
          addressLine1: beForm.addressLine1,
          postalCode: beForm.postalCode,
          city: beForm.city,
          iban: beForm.iban,
          vatNumber: beForm.vatNumber || undefined,
          defaultVatRate: parseFloat(beForm.defaultVatRate) || 7.7,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to create billing entity");
      }
      const data = await res.json();
      const newBE = data?.data;
      if (newBE?.id) {
        setBillingEntities((prev) => [newBE, ...prev]);
        setSelectedBillingEntityId(newBE.id);
        setShowCreateBE(false);
        setBeForm({ name: "", addressLine1: "", postalCode: "", city: "", iban: "", vatNumber: "", defaultVatRate: "7.7" });
        await saveBillingEntity(newBE.id);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBeSaving(false);
    }
  }

  const inv = invoice;
  const isIngested = inv?.sourceChannel && inv.sourceChannel !== "MANUAL";
  const isPendingReview = inv?.ingestionStatus === "PENDING_REVIEW";

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title={loading ? "Invoice" : `Invoice ${inv?.invoiceNumber || id?.slice(0, 8) || ""}`}
          breadcrumbs={[
            { label: "Finance", href: "/manager/finance" },
            { label: "Invoices", href: "/manager/finance/invoices" },
          ]}
          actions={
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Back
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">Dismiss</button>
            </div>
          )}

          {loading ? (
            <Panel><p className="loading-text">Loading invoice…</p></Panel>
          ) : !inv ? (
            <div className="empty-state"><p className="empty-state-text">Invoice not found.</p></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Status & actions bar */}
                <Panel>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.status} />
                      <IngestionBadge ingestionStatus={inv.ingestionStatus} />
                      {inv.direction && (
                        <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {inv.direction === "INCOMING" ? "↓ Incoming" : "↑ Outgoing"}
                        </span>
                      )}
                      {inv.sourceChannel && SOURCE_LABEL[inv.sourceChannel] && (
                        <span className={"inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium " + SOURCE_LABEL[inv.sourceChannel].cls}>
                          {SOURCE_LABEL[inv.sourceChannel].text}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {inv.status === "DRAFT" && (
                        <button
                          onClick={() => invoiceAction("issue")}
                          disabled={actionLoading}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          ▸ Issue
                        </button>
                      )}
                      {inv.status === "ISSUED" && (
                        <button
                          onClick={() => invoiceAction("approve")}
                          disabled={actionLoading}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                      )}
                      {inv.status === "APPROVED" && (
                        <button
                          onClick={() => invoiceAction("mark-paid")}
                          disabled={actionLoading}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          ✓ Mark Paid
                        </button>
                      )}
                      {["ISSUED", "APPROVED"].includes(inv.status) && (
                        <button
                          onClick={() => invoiceAction("dispute")}
                          disabled={actionLoading}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          ✗ Dispute
                        </button>
                      )}
                      <a
                        href={`/api/invoices/${id}/pdf`}
                        download
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition no-underline"
                      >
                        ↓ PDF
                      </a>
                    </div>
                  </div>
                </Panel>

                {/* Pending review notice */}
                {isPendingReview && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-medium text-amber-700 mt-0 mb-1">⚠ This invoice needs review</p>
                    <p className="text-xs text-amber-700 m-0">
                      This invoice was ingested via {SOURCE_LABEL[inv.sourceChannel]?.text || "scanner"} with
                      {typeof inv.ocrConfidence === "number" ? ` ${inv.ocrConfidence}% confidence` : " unknown confidence"}.
                      Please verify the extracted data before issuing.
                    </p>
                  </div>
                )}

                {/* Core details */}
                <Panel title="Invoice Details">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label="Invoice Number" value={inv.invoiceNumber} />
                    <Field label="Direction" value={inv.direction === "INCOMING" ? "Incoming" : "Outgoing"} />
                    <Field label="Currency" value={inv.currency || "CHF"} />
                    <Field label="Subtotal" value={formatChf(inv.subtotalAmount)} />
                    <Field label="VAT" value={inv.vatRate != null ? `${inv.vatRate}% — ${formatChf(inv.vatAmount)}` : formatChf(inv.vatAmount)} />
                    <Field label="Total" value={formatChf(inv.totalAmount)} />
                    <Field label="Issue Date" value={formatDate(inv.issueDate)} />
                    <Field label="Due Date" value={formatDate(inv.dueDate)} />
                    <Field label="Created" value={formatDate(inv.createdAt)} />
                    {inv.paymentReference && <Field label="Payment Ref" value={inv.paymentReference} />}
                    {inv.iban && <Field label="IBAN" value={inv.iban} />}
                  </dl>
                </Panel>

                {/* Recipient */}
                <Panel title="Recipient">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label="Name" value={inv.recipientName} />
                    <Field label="Address" value={[inv.recipientAddressLine1, inv.recipientAddressLine2].filter(Boolean).join(", ")} />
                    <Field label="Postal Code · City" value={[inv.recipientPostalCode, inv.recipientCity].filter(Boolean).join(" ")} />
                    <Field label="Country" value={inv.recipientCountry} />
                  </dl>
                </Panel>

                {/* Issuer / Billing Entity */}
                <Panel title="Issuer (Billing Entity)">
                  {inv.issuerBillingEntityId ? (
                    (() => {
                      const linked = billingEntities.find((be) => be.id === inv.issuerBillingEntityId);
                      return linked ? (
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                          <Field label="Name" value={linked.name} />
                          <Field label="Address" value={linked.addressLine1} />
                          <Field label="City" value={`${linked.postalCode} ${linked.city}`} />
                          <Field label="IBAN" value={linked.iban} />
                          {linked.vatNumber && <Field label="VAT Number" value={linked.vatNumber} />}
                          <Field label="Type" value={linked.type} />
                        </dl>
                      ) : (
                        <p className="text-sm text-slate-500">Billing entity linked (ID: {inv.issuerBillingEntityId.slice(0, 8)}…)</p>
                      );
                    })()
                  ) : inv.status === "DRAFT" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0">
                        ⚠ No billing entity linked — required before issuing.
                      </p>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Select billing entity</label>
                          <select
                            value={selectedBillingEntityId}
                            onChange={(e) => setSelectedBillingEntityId(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">— Choose —</option>
                            {billingEntities.map((be) => (
                              <option key={be.id} value={be.id}>
                                {be.name} ({be.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => selectedBillingEntityId && saveBillingEntity(selectedBillingEntityId)}
                          disabled={!selectedBillingEntityId}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          Link
                        </button>
                      </div>

                      {!showCreateBE ? (
                        <button
                          onClick={() => setShowCreateBE(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + Create new billing entity
                        </button>
                      ) : (
                        <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                          <p className="text-sm font-medium text-slate-700 m-0">New Billing Entity</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Name *</label>
                              <input value={beForm.name} onChange={(e) => setBeForm((f) => ({ ...f, name: e.target.value }))} className="filter-input" placeholder="Company name" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Address *</label>
                              <input value={beForm.addressLine1} onChange={(e) => setBeForm((f) => ({ ...f, addressLine1: e.target.value }))} className="filter-input" placeholder="Street & number" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Postal Code *</label>
                              <input value={beForm.postalCode} onChange={(e) => setBeForm((f) => ({ ...f, postalCode: e.target.value }))} className="filter-input" placeholder="1000" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">City *</label>
                              <input value={beForm.city} onChange={(e) => setBeForm((f) => ({ ...f, city: e.target.value }))} className="filter-input" placeholder="Lausanne" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">IBAN *</label>
                              <input value={beForm.iban} onChange={(e) => setBeForm((f) => ({ ...f, iban: e.target.value }))} className="filter-input" placeholder="CH..." />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">VAT Number</label>
                              <input value={beForm.vatNumber} onChange={(e) => setBeForm((f) => ({ ...f, vatNumber: e.target.value }))} className="filter-input" placeholder="CHE-..." />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={createAndLinkBE}
                              disabled={beSaving || !beForm.name || !beForm.addressLine1 || !beForm.postalCode || !beForm.city || !beForm.iban}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                            >
                              {beSaving ? "Creating…" : "Create & Link"}
                            </button>
                            <button
                              onClick={() => setShowCreateBE(false)}
                              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No billing entity linked.</p>
                  )}
                </Panel>

                {/* Line items */}
                {inv.lineItems?.length > 0 && (
                  <Panel title="Line Items" bodyClassName="p-0">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Unit Price</th>
                          <th className="text-right">VAT %</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.lineItems.map((li, i) => (
                          <tr key={i}>
                            <td>{li.description || "—"}</td>
                            <td className="text-right">{li.quantity ?? "—"}</td>
                            <td className="text-right">{formatChf(li.unitPrice)}</td>
                            <td className="text-right">{li.vatRate != null ? `${li.vatRate}%` : "—"}</td>
                            <td className="text-right">{formatChf(li.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                )}

                {/* Linked records */}
                {(inv.matchedJobId || inv.matchedLeaseId || inv.matchedBuildingId || inv.jobId) && (
                  <Panel title="Linked Records">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {(inv.jobId || inv.matchedJobId) && (
                        <Field
                          label="Job"
                          value={
                            inv.requestId ? (
                              <Link
                                href={`/manager/requests/${inv.requestId}`}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                View linked request →
                              </Link>
                            ) : (
                              <Link
                                href="/manager/requests"
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                View requests →
                              </Link>
                            )
                          }
                        />
                      )}
                      {inv.matchedLeaseId && (
                        <Field
                          label="Lease"
                          value={
                            <Link href={`/manager/leases/${inv.matchedLeaseId}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                              View lease →
                            </Link>
                          }
                        />
                      )}
                    </dl>
                  </Panel>
                )}

                {/* Accounting */}
                {(inv.expenseType || inv.account) && (
                  <Panel title="Accounting">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {inv.expenseType && <Field label="Expense Type" value={`${inv.expenseType.name}${inv.expenseType.code ? ` (${inv.expenseType.code})` : ""}`} />}
                      {inv.account && <Field label="Account" value={`${inv.account.name}${inv.account.code ? ` (${inv.account.code})` : ""}`} />}
                    </dl>
                  </Panel>
                )}
              </div>

              {/* Right column: original capture + PDF preview */}
              <div className="space-y-6">
                {/* Original captured image (for ingested invoices) */}
                {inv.sourceFileUrl && inv.sourceChannel !== "MANUAL" && (
                  <Panel title="Original Capture">
                    <div className="space-y-3">
                      {inv.sourceFileUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                        <img
                          src={`/api/invoices/${id}/source-file`}
                          alt="Original captured document"
                          className="w-full rounded-lg border border-slate-200"
                        />
                      ) : (
                        <iframe
                          src={`/api/invoices/${id}/source-file`}
                          title="Original document"
                          className="w-full rounded-lg border-0 h-[500px]"
                        />
                      )}
                      <a
                        href={`/api/invoices/${id}/source-file`}
                        download
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                      >
                        ↓ Download original
                      </a>
                    </div>
                  </Panel>
                )}

                {/* Generated PDF preview */}
                <Panel title={inv.sourceFileUrl && inv.sourceChannel !== "MANUAL" ? "Generated PDF (from extracted data)" : "PDF Preview"}>
                  {pdfUrl ? (
                    <iframe src={pdfUrl} title="Invoice PDF" className="w-full rounded-lg border-0 h-[500px]" />
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-sm text-slate-400">PDF not available</p>
                    </div>
                  )}
                </Panel>

                {/* Timeline */}
                <Panel title="Timeline">
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Created</span><span>{formatDate(inv.createdAt)}</span></div>
                    {inv.submittedAt && <div className="flex justify-between"><span>Submitted</span><span>{formatDate(inv.submittedAt)}</span></div>}
                    {inv.lockedAt && <div className="flex justify-between"><span>Locked</span><span>{formatDate(inv.lockedAt)}</span></div>}
                    {inv.approvedAt && <div className="flex justify-between"><span>Approved</span><span>{formatDate(inv.approvedAt)}</span></div>}
                    {inv.paidAt && <div className="flex justify-between"><span>Paid</span><span>{formatDate(inv.paidAt)}</span></div>}
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
