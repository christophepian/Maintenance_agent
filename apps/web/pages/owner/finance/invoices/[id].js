import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../../components/AppShell";
import PageShell from "../../../../components/layout/PageShell";
import PageHeader from "../../../../components/layout/PageHeader";
import PageContent from "../../../../components/layout/PageContent";
import Panel from "../../../../components/layout/Panel";
import Badge from "../../../../components/ui/Badge";
import { invoiceVariant, ingestionVariant } from "../../../../lib/statusVariants";
import { formatChf, formatDate } from "../../../../lib/format";
import { ownerAuthHeaders } from "../../../../lib/api";
import { withServerTranslations } from "../../../../lib/i18n";
import { useTranslation } from "next-i18next";

/* ─── Badge helpers ────────────────────────────────────────── */

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
  EMAIL_PDF:      { text: "Email",  cls: "bg-violet-50 text-violet-700 border-violet-200" },
  MOBILE_CAPTURE: { text: "Mobile", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  MANUAL:         { text: "Manual", cls: "bg-surface-subtle text-muted-text border-surface-border" },
};

/* ─── Detail field ─────────────────────────────────────────── */

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

/* ─── Dispute modal ────────────────────────────────────────── */

function DisputeModal({ onConfirm, onCancel }) {
  const { t } = useTranslation("owner");
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t("owner:financeInvoicesId.ariaLabel.disputeInvoice")}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-6 shadow-xl space-y-4">
        <h2 className="text-base font-semibold text-foreground">{t("owner:financeInvoicesId.heading.disputeThisInvoice")}</h2>
        <div>
          <label htmlFor="dispute-reason" className="block text-sm font-medium text-muted-dark mb-1">
            Reason <span className="text-foreground-dim font-normal">(required)</span>
          </label>
          <textarea
            id="dispute-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("owner:financeInvoicesId.placeholder.describeWhyYouAreDisputingThisInvoice")}
            className="filter-input resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-surface-border bg-surface py-2.5 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
          >
            Confirm Dispute
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

export default function OwnerInvoiceDetailPage() {
  const { t } = useTranslation("owner");
  const router = useRouter();
  const { id } = router.query;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}`, { headers: ownerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to load invoice");
      setInvoice(data?.data || null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function invoiceAction(action, body) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ownerAuthHeaders() },
        body: body ? JSON.stringify(body) : JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.error || `Failed to ${action}`);
      }
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisputeConfirm(reason) {
    await invoiceAction("dispute", { reason });
    setShowDispute(false);
  }

  const inv = invoice;
  // If direction is explicitly set, trust it. If not, default to incoming
  // (owner-visible invoices without a direction are service/maintenance invoices, always incoming).
  const isIncoming = inv?.direction ? inv.direction === "INCOMING" : true;

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title={loading ? "Invoice" : `Invoice ${inv?.invoiceNumber || id?.slice(0, 8) || ""}`}
          breadcrumbs={[
            { label: "Finance", href: "/owner/finance?tab=invoices" },
            { label: "Invoices", href: "/owner/finance?tab=invoices" },
          ]}
          actions={
            <button
              onClick={() => router.push("/owner/finance?tab=invoices")}
              className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-text hover:bg-surface-subtle transition"
            >
              ← Back
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-red-700"><strong>{t("owner:financeInvoicesId.text.error")}</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">{t("owner:financeInvoicesId.text.dismiss")}</button>
            </div>
          )}

          {loading ? (
            <Panel><p className="loading-text">{t("owner:financeInvoicesId.text.loadingInvoice")}</p></Panel>
          ) : !inv ? (
            <div className="empty-state"><p className="empty-state-text">{t("owner:financeInvoicesId.text.invoiceNotFound")}</p></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">

                {/* Status & actions bar */}
                <Panel>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={invoiceVariant(inv.status)} size="sm">{inv.status}</Badge>
                      <IngestionBadge ingestionStatus={inv.ingestionStatus} />
                      {inv.direction && (
                        <span className="inline-flex items-center rounded-full bg-surface-subtle border border-surface-border px-2 py-0.5 text-xs font-medium text-muted">
                          {inv.direction === "INCOMING" ? "↓ Incoming" : "↑ Outgoing"}
                        </span>
                      )}
                      {inv.sourceChannel && SOURCE_LABEL[inv.sourceChannel] && (
                        <span className={"inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium " + SOURCE_LABEL[inv.sourceChannel].cls}>
                          {SOURCE_LABEL[inv.sourceChannel].text}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* Approve — incoming ISSUED only (no Issue / no Mark Paid for owner) */}
                      {isIncoming && inv.status === "ISSUED" && (
                        <button
                          onClick={() => invoiceAction("approve")}
                          disabled={actionLoading}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                      )}
                      {/* Dispute — incoming non-final */}
                      {isIncoming && ["ISSUED", "DRAFT", "APPROVED"].includes(inv.status) && (
                        <button
                          onClick={() => setShowDispute(true)}
                          disabled={actionLoading}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          ✗ Dispute
                        </button>
                      )}
                      <a
                        href={`/api/invoices/${id}/pdf`}
                        download
                        className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition no-underline"
                      >
                        ↓ PDF
                      </a>
                    </div>
                  </div>
                </Panel>

                {/* Invoice details */}
                <Panel title={t("owner:financeInvoicesId.title.invoiceDetails")}>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label={t("owner:financeInvoicesId.prop.invoiceNumber")} value={inv.invoiceNumber} />
                    <Field label={t("owner:financeInvoicesId.prop.direction")} value={inv.direction === "INCOMING" ? "Incoming" : "Outgoing"} />
                    <Field label={t("owner:financeInvoicesId.prop.currency")} value={inv.currency || "CHF"} />
                    <Field label={t("owner:financeInvoicesId.prop.subtotal")} value={formatChf(inv.subtotalAmount)} />
                    <Field label="VAT" value={inv.vatRate != null ? `${inv.vatRate}% — ${formatChf(inv.vatAmount)}` : formatChf(inv.vatAmount)} />
                    <Field label={t("owner:financeInvoicesId.col.total")} value={formatChf(inv.totalAmount)} />
                    <Field label={t("owner:financeInvoicesId.prop.issueDate")} value={formatDate(inv.issueDate)} />
                    <Field label={t("owner:financeInvoicesId.prop.dueDate")} value={formatDate(inv.dueDate)} />
                    <Field label={t("owner:financeInvoicesId.prop.created")} value={formatDate(inv.createdAt)} />
                    {inv.paymentReference && <Field label={t("owner:financeInvoicesId.prop.paymentRef")} value={inv.paymentReference} />}
                    {inv.iban && <Field label="IBAN" value={inv.iban} />}
                  </dl>
                </Panel>

                {/* Recipient */}
                <Panel title={t("owner:financeInvoicesId.title.recipient")}>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label={t("owner:financeInvoicesId.prop.name")} value={inv.recipientName} />
                    <Field label={t("owner:financeInvoicesId.prop.address")} value={[inv.recipientAddressLine1, inv.recipientAddressLine2].filter(Boolean).join(", ")} />
                    <Field label={t("owner:financeInvoicesId.prop.postalCodeCity")} value={[inv.recipientPostalCode, inv.recipientCity].filter(Boolean).join(" ")} />
                    <Field label={t("owner:financeInvoicesId.prop.country")} value={inv.recipientCountry} />
                  </dl>
                </Panel>

                {/* Issuer */}
                {(inv.issuerName || inv.issuerBillingEntityId) && (
                  <Panel title={t("owner:financeInvoicesId.title.issuer")}>
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                      <Field label={t("owner:financeInvoicesId.prop.name")} value={inv.issuerName} />
                    </dl>
                  </Panel>
                )}

                {/* Line items */}
                {inv.lineItems?.length > 0 && (
                  <Panel title={t("owner:financeInvoicesId.title.lineItems")} bodyClassName="p-0">
                    <div className="sm:hidden divide-y divide-slate-100">
                      {inv.lineItems.map((li, i) => (
                        <div key={i} className="px-4 py-3 flex flex-col gap-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{li.description || "—"}</span>
                            <span className="text-sm font-mono text-muted-dark shrink-0">{formatChf(li.lineTotal)}</span>
                          </div>
                          <span className="text-xs text-muted">
                            {li.quantity ?? "—"} × {formatChf(li.unitPrice)}
                            {li.vatRate != null && <span className="ml-1">· VAT {li.vatRate}%</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="hidden sm:block data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{t("owner:financeInvoicesId.col.description")}</th>
                            <th className="text-right">{t("owner:financeInvoicesId.col.qty")}</th>
                            <th className="text-right">{t("owner:financeInvoicesId.col.unitPrice")}</th>
                            <th className="text-right">{t("owner:financeInvoicesId.col.vAT")}</th>
                            <th className="text-right">{t("owner:financeInvoicesId.col.total")}</th>
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

                {/* Accounting */}
                {(inv.expenseType || inv.account) && (
                  <Panel title={t("owner:financeInvoicesId.title.accounting")}>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {inv.expenseType && <Field label={t("owner:financeInvoicesId.prop.expenseType")} value={`${inv.expenseType.name}${inv.expenseType.code ? ` (${inv.expenseType.code})` : ""}`} />}
                      {inv.account && <Field label={t("owner:financeInvoicesId.prop.account")} value={`${inv.account.name}${inv.account.code ? ` (${inv.account.code})` : ""}`} />}
                    </dl>
                  </Panel>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Original capture (image sources) */}
                {inv.sourceFileUrl && inv.sourceChannel !== "MANUAL" && inv.sourceFileUrl.match(/\.(jpg|jpeg|png|webp)$/i) && (
                  <Panel title={t("owner:financeInvoicesId.title.originalCapture")}>
                    <div className="space-y-3">
                      <img
                        src={`/api/invoices/${id}/source-file`}
                        alt="Original captured document"
                        className="w-full rounded-lg border border-surface-border"
                      />
                      <a href={`/api/invoices/${id}/source-file`} download className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                        ↓ Download original
                      </a>
                    </div>
                  </Panel>
                )}

                {/* PDF preview */}
                <Panel title={t("owner:financeInvoicesId.title.pDFPreview")}>
                  <iframe
                    src={`/api/invoices/${id}/pdf`}
                    title={t("owner:financeInvoicesId.title.invoicePdf")}
                    className="w-full rounded-lg border-0 h-[500px]"
                  />
                </Panel>

                {/* Timeline */}
                <Panel title={t("owner:financeInvoicesId.title.timeline")}>
                  <div className="space-y-2 text-xs text-muted-text">
                    <div className="flex justify-between"><span>{t("owner:financeInvoicesId.text.created")}</span><span>{formatDate(inv.createdAt)}</span></div>
                    {inv.submittedAt && <div className="flex justify-between"><span>{t("owner:financeInvoicesId.text.submitted")}</span><span>{formatDate(inv.submittedAt)}</span></div>}
                    {inv.approvedAt && <div className="flex justify-between"><span>{t("owner:financeInvoicesId.text.approved")}</span><span>{formatDate(inv.approvedAt)}</span></div>}
                    {inv.paidAt && <div className="flex justify-between"><span>{t("owner:financeInvoicesId.text.paid")}</span><span>{formatDate(inv.paidAt)}</span></div>}
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </PageContent>
      </PageShell>

      {showDispute && (
        <DisputeModal
          onConfirm={handleDisputeConfirm}
          onCancel={() => setShowDispute(false)}
        />
      )}
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common","owner"]);
