import { useEffect, useState, useCallback, useRef } from "react";
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
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

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
  const { t } = useTranslation("manager");
  const router = useRouter();
  const { id } = router.query;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [billingEntities, setBillingEntities] = useState([]);
  const [selectedBillingEntityId, setSelectedBillingEntityId] = useState("");
  const [showCreateBE, setShowCreateBE] = useState(false);
  const [beForm, setBeForm] = useState({ name: "", addressLine1: "", postalCode: "", city: "", iban: "", vatNumber: "", defaultVatRate: "7.7" });
  const [beSaving, setBeSaving] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [sourceBlobUrl, setSourceBlobUrl] = useState(null);
  const pdfBlobRef = useRef(null);
  const sourceBlobRef = useRef(null);

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

  // Fetch PDF + source file with auth headers → blob URLs for iframe/img
  useEffect(() => {
    if (!id) return;
    // PDF
    fetch(`/api/invoices/${id}/pdf`, { headers: authHeaders() })
      .then((r) => r.ok ? r.blob() : Promise.reject())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current);
        pdfBlobRef.current = url;
        setPdfBlobUrl(url);
      })
      .catch(() => {});
    // Source image (only matters for image captures; no-op for PDFs/manual)
    fetch(`/api/invoices/${id}/source-file`, { headers: authHeaders() })
      .then((r) => r.ok ? r.blob() : Promise.reject())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (sourceBlobRef.current) URL.revokeObjectURL(sourceBlobRef.current);
        sourceBlobRef.current = url;
        setSourceBlobUrl(url);
      })
      .catch(() => {});
    return () => {
      if (pdfBlobRef.current) { URL.revokeObjectURL(pdfBlobRef.current); pdfBlobRef.current = null; }
      if (sourceBlobRef.current) { URL.revokeObjectURL(sourceBlobRef.current); sourceBlobRef.current = null; }
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
              onClick={() => router.push("/manager/finance/invoices")}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Back
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-red-700"><strong>{t("manager:financeInvoicesId.text.error")}</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">{t("manager:financeInvoicesId.text.dismiss")}</button>
            </div>
          )}

          {loading ? (
            <Panel><p className="loading-text">{t("manager:financeInvoicesId.text.loadingInvoice")}</p></Panel>
          ) : !inv ? (
            <div className="empty-state"><p className="empty-state-text">{t("manager:financeInvoicesId.text.invoiceNotFound")}</p></div>
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
                    {inv.status === "DRAFT" && !inv.issuerBillingEntityId && !selectedBillingEntityId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ⚠ No billing entity — select one below to enable Issue
                      </span>
                    )}
                      {inv.direction && (
                        <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {inv.direction === "INCOMING" ? "↓ Incoming" : "↑ Outgoing"}
                        </span>
                      )}
                      {inv.sourceChannel && SOURCE_LABEL[inv.sourceChannel] && (
                        <span className={"inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium " + SOURCE_LABEL[inv.sourceChannel].cls}>
                          {SOURCE_LABEL[inv.sourceChannel].text}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {inv.status === "DRAFT" && (() => {
                        const effectiveIssuerId = inv.issuerBillingEntityId || selectedBillingEntityId;
                        const missingIssuer = !effectiveIssuerId;
                        return (
                          <button
                            onClick={() => invoiceAction("issue", effectiveIssuerId ? { issuerBillingEntityId: effectiveIssuerId } : undefined)}
                            disabled={actionLoading || missingIssuer}
                            title={missingIssuer ? "Select or create a billing entity below before issuing" : undefined}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ▸ Issue
                          </button>
                        );
                      })()}
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
                      <button
                        type="button"
                        disabled={!pdfBlobUrl}
                        onClick={() => { if (pdfBlobUrl) { const a = document.createElement("a"); a.href = pdfBlobUrl; a.download = `invoice-${id.slice(0, 8)}.pdf`; a.click(); } }}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                      >
                        ↓ PDF
                      </button>
                    </div>
                  </div>
                </Panel>

                {/* Pending review notice */}
                {isPendingReview && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-medium text-amber-700 mt-0 mb-1">{t("manager:financeInvoicesId.text.thisInvoiceNeedsReview")}</p>
                    <p className="text-xs text-amber-700 m-0">
                      This invoice was ingested via {SOURCE_LABEL[inv.sourceChannel]?.text || "scanner"} with
                      {typeof inv.ocrConfidence === "number" ? ` ${inv.ocrConfidence}% confidence` : " unknown confidence"}.
                      Please verify the extracted data before issuing.
                    </p>
                  </div>
                )}

                {/* Core details */}
                <Panel title={t("manager:financeInvoicesId.title.invoiceDetails")}>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label={t("manager:financeInvoicesId.prop.invoiceNumber")} value={inv.invoiceNumber} />
                    <Field label={t("manager:financeInvoicesId.prop.direction")} value={inv.direction === "INCOMING" ? "Incoming" : "Outgoing"} />
                    <Field label={t("manager:financeInvoicesId.prop.currency")} value={inv.currency || "CHF"} />
                    <Field label={t("manager:financeInvoicesId.prop.subtotal")} value={formatChf(inv.subtotalAmount)} />
                    <Field label="VAT" value={inv.vatRate != null ? `${inv.vatRate}% — ${formatChf(inv.vatAmount)}` : formatChf(inv.vatAmount)} />
                    <Field label={t("manager:financeInvoicesId.col.total")} value={formatChf(inv.totalAmount)} />
                    <Field label={t("manager:financeInvoicesId.prop.issueDate")} value={formatDate(inv.issueDate)} />
                    <Field label={t("manager:financeInvoicesId.prop.dueDate")} value={formatDate(inv.dueDate)} />
                    <Field label={t("manager:financeInvoicesId.prop.created")} value={formatDate(inv.createdAt)} />
                    {inv.paymentReference && <Field label={t("manager:financeInvoicesId.prop.paymentRef")} value={inv.paymentReference} />}
                    {inv.iban && <Field label="IBAN" value={inv.iban} />}
                  </dl>
                </Panel>

                {/* Recipient */}
                <Panel title={t("manager:financeInvoicesId.title.recipient")}>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label={t("manager:financeInvoicesId.prop.name")} value={inv.recipientName} />
                    <Field label={t("manager:financeInvoicesId.prop.address")} value={[inv.recipientAddressLine1, inv.recipientAddressLine2].filter(Boolean).join(", ")} />
                    <Field label={t("manager:financeInvoicesId.prop.postalCodeCity")} value={[inv.recipientPostalCode, inv.recipientCity].filter(Boolean).join(" ")} />
                    <Field label={t("manager:financeInvoicesId.prop.country")} value={inv.recipientCountry} />
                  </dl>
                </Panel>

                {/* Issuer / Billing Entity */}
                <Panel title={t("manager:financeInvoicesId.title.issuerBillingEntity")}>
                  {inv.issuerBillingEntityId ? (
                    (() => {
                      const linked = billingEntities.find((be) => be.id === inv.issuerBillingEntityId);
                      return linked ? (
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                          <Field label={t("manager:financeInvoicesId.prop.name")} value={linked.name} />
                          <Field label={t("manager:financeInvoicesId.prop.address")} value={linked.addressLine1} />
                          <Field label={t("manager:financeInvoicesId.prop.city")} value={`${linked.postalCode} ${linked.city}`} />
                          <Field label="IBAN" value={linked.iban} />
                          {linked.vatNumber && <Field label={t("manager:financeInvoicesId.prop.vATNumber")} value={linked.vatNumber} />}
                          <Field label={t("manager:financeInvoicesId.prop.type")} value={linked.type} />
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
                          <label className="block text-xs font-medium text-slate-500 mb-1">{t("manager:financeInvoicesId.text.selectBillingEntity")}</label>
                          <select
                            value={selectedBillingEntityId}
                            onChange={(e) => setSelectedBillingEntityId(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">{t("manager:financeInvoicesId.text.choose")}</option>
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
                          <p className="text-sm font-medium text-slate-700 m-0">{t("manager:financeInvoicesId.text.newBillingEntity")}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">{t("manager:financeInvoicesId.text.name")}</label>
                              <input value={beForm.name} onChange={(e) => setBeForm((f) => ({ ...f, name: e.target.value }))} className="filter-input" placeholder={t("manager:financeInvoicesId.placeholder.companyName")} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">{t("manager:financeInvoicesId.text.address")}</label>
                              <input value={beForm.addressLine1} onChange={(e) => setBeForm((f) => ({ ...f, addressLine1: e.target.value }))} className="filter-input" placeholder={t("manager:financeInvoicesId.placeholder.streetNumber")} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">{t("manager:financeInvoicesId.text.postalCode")}</label>
                              <input value={beForm.postalCode} onChange={(e) => setBeForm((f) => ({ ...f, postalCode: e.target.value }))} className="filter-input" placeholder="1000" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">{t("manager:financeInvoicesId.text.city")}</label>
                              <input value={beForm.city} onChange={(e) => setBeForm((f) => ({ ...f, city: e.target.value }))} className="filter-input" placeholder={t("manager:financeInvoicesId.placeholder.lausanne")} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">{t("manager:financeInvoicesId.text.iBAN")}</label>
                              <input value={beForm.iban} onChange={(e) => setBeForm((f) => ({ ...f, iban: e.target.value }))} className="filter-input" placeholder={t("manager:financeInvoicesId.placeholder.cH")} />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">{t("manager:financeInvoicesId.text.vATNumber")}</label>
                              <input value={beForm.vatNumber} onChange={(e) => setBeForm((f) => ({ ...f, vatNumber: e.target.value }))} className="filter-input" placeholder={t("manager:financeInvoicesId.placeholder.cHE")} />
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
                    <p className="text-sm text-slate-500">{t("manager:financeInvoicesId.text.noBillingEntityLinked")}</p>
                  )}
                </Panel>

                {/* Line items */}
                {inv.lineItems?.length > 0 && (
                  <Panel title={t("manager:financeInvoicesId.title.lineItems")} bodyClassName="p-0">
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-slate-100">
                      {inv.lineItems.map((li, i) => (
                        <div key={i} className="px-4 py-3 flex flex-col gap-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800">{li.description || "—"}</span>
                            <span className="text-sm font-mono text-slate-700 shrink-0">{formatChf(li.lineTotal)}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {li.quantity ?? "—"} × {formatChf(li.unitPrice)}
                            {li.vatRate != null && <span className="ml-1">· VAT {li.vatRate}%</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden sm:block data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{t("manager:financeInvoicesId.col.description")}</th>
                            <th className="text-right">{t("manager:financeInvoicesId.col.qty")}</th>
                            <th className="text-right">{t("manager:financeInvoicesId.col.unitPrice")}</th>
                            <th className="text-right">{t("manager:financeInvoicesId.col.vAT")}</th>
                            <th className="text-right">{t("manager:financeInvoicesId.col.total")}</th>
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
                    </div>
                  </Panel>
                )}

                {/* Linked records */}
                {(inv.matchedJobId || inv.matchedLeaseId || inv.matchedBuildingId || inv.jobId) && (
                  <Panel title={t("manager:financeInvoicesId.title.linkedRecords")}>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {(inv.jobId || inv.matchedJobId) && (
                        <Field
                          label={t("manager:financeInvoicesId.prop.job")}
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
                          label={t("manager:financeInvoicesId.prop.lease")}
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
                  <Panel title={t("manager:financeInvoicesId.title.accounting")}>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {inv.expenseType && <Field label={t("manager:financeInvoicesId.prop.expenseType")} value={`${inv.expenseType.name}${inv.expenseType.code ? ` (${inv.expenseType.code})` : ""}`} />}
                      {inv.account && <Field label={t("manager:financeInvoicesId.prop.account")} value={`${inv.account.name}${inv.account.code ? ` (${inv.account.code})` : ""}`} />}
                    </dl>
                  </Panel>
                )}
              </div>

              {/* Right column: original capture + PDF preview */}
              <div className="space-y-6">
                {/* Original captured image — only for image-type sources (jpg/png/webp) */}
                {inv.sourceFileUrl && inv.sourceChannel !== "MANUAL" && inv.sourceFileUrl.match(/\.(jpg|jpeg|png|webp)$/i) && sourceBlobUrl && (
                  <Panel title={t("manager:financeInvoicesId.title.originalCapture")}>
                    <div className="space-y-3">
                      <img
                        src={sourceBlobUrl}
                        alt="Original captured document"
                        className="w-full rounded-lg border border-slate-200"
                      />
                      <a
                        href={sourceBlobUrl}
                        download={`capture-${id.slice(0, 8)}.jpg`}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                      >
                        ↓ Download original
                      </a>
                    </div>
                  </Panel>
                )}

                {/* PDF preview — always shown */}
                <Panel title={t("manager:financeInvoicesId.title.pDFPreview")}>
                  {pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      title={t("manager:financeInvoicesId.title.invoicePdf")}
                      className="w-full rounded-lg border-0 h-[500px]"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-sm text-slate-400">Loading preview…</p>
                    </div>
                  )}
                </Panel>

                {/* Timeline */}
                <Panel title={t("manager:financeInvoicesId.title.timeline")}>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between"><span>{t("manager:financeInvoicesId.text.created")}</span><span>{formatDate(inv.createdAt)}</span></div>
                    {inv.submittedAt && <div className="flex justify-between"><span>{t("manager:financeInvoicesId.text.submitted")}</span><span>{formatDate(inv.submittedAt)}</span></div>}
                    {inv.lockedAt && <div className="flex justify-between"><span>{t("manager:financeInvoicesId.text.locked")}</span><span>{formatDate(inv.lockedAt)}</span></div>}
                    {inv.approvedAt && <div className="flex justify-between"><span>{t("manager:financeInvoicesId.text.approved")}</span><span>{formatDate(inv.approvedAt)}</span></div>}
                    {inv.paidAt && <div className="flex justify-between"><span>{t("manager:financeInvoicesId.text.paid")}</span><span>{formatDate(inv.paidAt)}</span></div>}
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

export const getServerSideProps = withServerTranslations(["common","manager"]);
