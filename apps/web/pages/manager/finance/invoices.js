import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ConfigurableTable from "../../../components/ConfigurableTable";
import PaginationControls from "../../../components/PaginationControls";
import { useLocalSort, clientSort } from "../../../lib/tableUtils";
import { FilterToggle, FilterPanelBody, FilterSection, FilterSectionClear } from "../../../components/ui/FilterPanel";
import { authHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import { invoiceVariant, ingestionVariant } from "../../../lib/statusVariants";

import { cn } from "../../../lib/utils";
import { withTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
/* ─── Helpers ─────────────────────────────────────────────── */

const INVOICE_SORT_FIELDS = ["status", "invoiceNumber", "amount", "createdAt", "issuer", "recipient", "building", "recurring", "category"];

function invoiceFieldExtractor(inv, field) {
  switch (field) {
    case "status": return inv.status ?? "";
    case "invoiceNumber": return inv.invoiceNumber ?? "";
    case "amount": return inv.totalAmount ?? inv.amount ?? -1;
    case "createdAt": return inv.createdAt || "";
    case "issuer": return (inv.issuerName || "").toLowerCase();
    case "recipient": return (inv.recipientName || "").toLowerCase();
    case "building": return ((inv.buildingName || "") + (inv.unitNumber || "")).toLowerCase();
    case "recurring": return (inv.billingScheduleId || inv.contractorBillingScheduleId) ? "1" : "0";
    case "category": return (inv.expenseCategory || "").toLowerCase();
    default: return "";
  }
}

const INCOMING_STATUS_TABS = [
  { key: "ALL" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "DRAFT" },
  { key: "ISSUED" },
  { key: "APPROVED" },
  { key: "PAID" },
  { key: "DISPUTED" },
];

const OUTGOING_STATUS_TABS = [
  { key: "ALL" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "DRAFT" },
  { key: "ISSUED" },
  { key: "APPROVED" },
  { key: "PAID" },
  { key: "DISPUTED" },
];

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

/* ─── StatusBadge (shared Badge) ────────────────────────────── */

function StatusBadge({ status }) {
  return (
    <Badge variant={invoiceVariant(status)} size="sm">
      {status}
    </Badge>
  );
}

/* ─── Ingestion badges & source icons ─────────────────────── */

const INGESTION_LABEL = {
  PENDING_REVIEW: "Needs review",
  AUTO_CONFIRMED: "Auto-confirmed",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

function IngestionBadge({ ingestionStatus }) {
  if (!ingestionStatus) return null;
  return (
    <Badge variant={ingestionVariant(ingestionStatus)} size="sm" className="ml-1.5">
      {INGESTION_LABEL[ingestionStatus] || ingestionStatus}
    </Badge>
  );
}

const SOURCE_LABEL = {
  BROWSER_UPLOAD: { text: "Upload", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  EMAIL_PDF: { text: "Email", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  MOBILE_CAPTURE: { text: "Mobile", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  MANUAL: { text: "Manual", cls: "bg-surface-subtle text-muted-text border-surface-border" },
};

function SourceChannelIcon({ channel }) {
  if (!channel || !SOURCE_LABEL[channel]) return null;
  const { text, cls } = SOURCE_LABEL[channel];
  return <span title={channel} className={"inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium mr-1 " + cls}>{text}</span>;
}

/* ─── ActionDropdown (same pattern as vacancies) ──────────── */

function ActionDropdown({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!actions.length) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-dark hover:bg-surface-subtle transition"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-surface-border bg-surface shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                disabled={a.disabled}
                onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-surface-subtle transition disabled:opacity-40 " + (a.className || "text-muted-dark")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Invoice PDF Overlay ─────────────────────────────────── */

function InvoiceOverlay({ invoiceId, onClose }) {
  const { t } = useTranslation("manager");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [detail, setDetail] = useState(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!invoiceId) return;
    setPdfUrl(null);
    setPdfError(false);
    setDetail(null);

    // Revoke previous blob URL to avoid memory leaks
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Fetch invoice detail for header
    fetch(`/api/invoices/${invoiceId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d?.data) setDetail(d.data); })
      .catch(() => {});

    // Fetch PDF with auth headers → blob URL so the iframe never needs a JWT
    fetch(`/api/invoices/${invoiceId}/pdf`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("PDF load failed");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPdfUrl(url);
      })
      .catch(() => setPdfError(true));

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [invoiceId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!invoiceId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-surface rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground m-0">
              Invoice {detail?.invoiceNumber || invoiceId.slice(0, 8)}
            </h2>
            {detail && (
              <p className="text-sm text-muted mt-0.5 mb-0">
                {detail.recipientName} · {formatChf(detail.totalAmount)} · {detail.status}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (pdfUrl) {
                  const a = document.createElement("a");
                  a.href = pdfUrl;
                  a.download = `invoice-${invoiceId.slice(0, 8)}.pdf`;
                  a.click();
                }
              }}
              disabled={!pdfUrl}
              className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-dark hover:bg-surface-subtle transition disabled:opacity-40"
            >
              ↓ Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-dark hover:bg-surface-subtle transition"
            >
              ✕ Close
            </button>
          </div>
        </div>
        {/* PDF embed */}
        <div className="flex-1 overflow-hidden">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={t("manager:financeInvoices.title.invoicePdf")}
              className="w-full h-full border-0"
            />
          ) : pdfError ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-foreground-dim text-sm">Could not load PDF.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-foreground-dim">{t("manager:financeInvoices.text.loadingPdf")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Dispute Justification Modal ─────────────────────────── */

function DisputeModal({ invoiceId, onConfirm, onCancel }) {
  const { t } = useTranslation("manager");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    await onConfirm(invoiceId, reason.trim());
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mt-0 mb-1">{t("manager:financeInvoices.heading.disputeInvoice")}</h3>
        <p className="text-sm text-muted mt-0 mb-4">
          Provide a justification for disputing this invoice. The contractor will be notified.
        </p>
        <textarea
          className="w-full rounded-lg border border-muted-ring px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={4}
          placeholder={t("manager:financeInvoices.placeholder.reasonForDispute")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          required
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !reason.trim()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Confirm Dispute"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Upload Invoice Modal ────────────────────────────────── */

function UploadInvoiceModal({ onClose, onSuccess }) {
  const { t } = useTranslation("manager");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceChannel", "BROWSER_UPLOAD");
      formData.append("direction", "INCOMING");
      const res = await fetch("/api/invoices/ingest", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Upload failed");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleUpload}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mt-0 mb-1">{t("manager:financeInvoices.heading.uploadInvoice")}</h3>
        <p className="text-sm text-muted mt-0 mb-4">
          Upload a PDF or image of an invoice. It will be scanned and pre-filled automatically.
        </p>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploadError && (
          <p className="text-sm text-red-600 mt-2">{uploadError}</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition">{t("manager:financeInvoices.text.cancel")}</button>
          <button type="submit" disabled={!file || uploading} className="button-primary text-sm disabled:opacity-50">
            {uploading ? "Scanning…" : "Upload & Scan"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Capture Session (QR) Modal ──────────────────────────── */

function CaptureSessionModal({ onClose, onComplete }) {
  const { t } = useTranslation("manager");
  const [session, setSession] = useState(null);
  const [creating, setCreating] = useState(true);
  const [createError, setCreateError] = useState("");
  const [completed, setCompleted] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Create capture session on mount
  useEffect(() => {
    let cancelled = false;
    async function create() {
      try {
        const res = await fetch("/api/capture-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message || "Failed to create session");
        }
        const data = await res.json();
        if (!cancelled) {
          setSession({ ...data.data, mobileUrl: data.mobileUrl });
          setCreating(false);
        }
      } catch (err) {
        if (!cancelled) {
          setCreateError(err.message || "Failed to create session");
          setCreating(false);
        }
      }
    }
    create();
    return () => { cancelled = true; };
  }, []);

  // Poll for session completion
  useEffect(() => {
    if (!session?.id || completed) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/capture-sessions/${session.id}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.data?.status === "COMPLETED") {
            setCompleted(true);
            clearInterval(pollRef.current);
            onComplete();
          }
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [session?.id, completed, onComplete]);

  const mobileUrl = session?.mobileUrl || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-foreground mt-0 mb-1">{t("manager:financeInvoices.text.captureWithPhone")}</h3>
        {creating ? (
          <p className="text-sm text-muted">{t("manager:financeInvoices.text.creatingCaptureSession")}</p>
        ) : createError ? (
          <div>
            <p className="text-sm text-red-600 mb-3">{createError}</p>
            <button onClick={onClose} className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition">{t("manager:financeInvoices.text.close")}</button>
          </div>
        ) : completed ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-green-700 mb-1">{t("manager:financeInvoices.text.photosReceived")}</p>
            <p className="text-xs text-muted mb-4">{t("manager:financeInvoices.text.theInvoiceIsBeingProcessed")}</p>
            <button onClick={onClose} className="button-primary text-sm">{t("manager:financeInvoices.text.done")}</button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mt-0 mb-4">
              Scan this QR code with your phone to capture a paper invoice.
            </p>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={mobileUrl} size={300} level="L" />
            </div>
            <div className="bg-surface-subtle rounded-lg p-2 mb-3">
              <p className="text-xs text-foreground-dim uppercase tracking-wide mb-0.5">{t("manager:financeInvoices.text.mobileLink")}</p>
              <p className="text-xs text-muted-text break-all font-mono select-all m-0">{mobileUrl}</p>
            </div>
            <p className="text-xs text-foreground-dim text-center mb-3">
              Session expires in 15 minutes. Waiting for photos…
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-muted-dark hover:bg-surface-subtle transition">{t("manager:financeInvoices.text.cancel")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Embeddable invoices content ─────────────────────────── */

export function InvoicesContent() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [direction, setDirection] = useState("incoming"); // "incoming" | "outgoing" | "pending"
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // Server-side pagination
  const PAGE_SIZE = 50;
  const [offset, setOffset] = useState(0);

  // Overlay state
  const [overlayInvoiceId, setOverlayInvoiceId] = useState(null);
  // Track whether we've already consumed the ?invoiceId= deep-link so
  // hot-reloads don't re-open the overlay on every compile.
  const deepLinkConsumed = useRef(false);

  // Dispute modal state
  const [disputeInvoiceId, setDisputeInvoiceId] = useState(null);

  // Upload & capture modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);

  // Toolbar
  const [invSearch, setInvSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // debounced value sent to server
  const [actionsOpen, setActionsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const isOutgoing = direction === "outgoing";
  const isPending = direction === "pending";

  // Sort — drives the server query (whitelisted scalar columns only).
  const INV_SORT_CYCLE = [
    { field: "createdAt", label: t("manager:financeInvoices.col.date") },
    { field: "amount",    label: "Amount" },
    { field: "status",    label: "Status" },
    { field: "invoiceNumber", label: t("manager:financeInvoices.col.invoice") },
  ];
  const [sortCycleIdx, setSortCycleIdx] = useState(0);
  const { sortField, sortDir, handleSort } = useLocalSort(
    INV_SORT_CYCLE[0].field, "desc"
  );
  function cycleSort() {
    const next = (sortCycleIdx + 1) % INV_SORT_CYCLE.length;
    setSortCycleIdx(next);
    handleSort(INV_SORT_CYCLE[next].field);
  }

  // Map UI column ids onto server-whitelisted sort fields.
  function toServerSortField(f) {
    if (f === "amount") return "totalAmount";
    if (f === "issuer" || f === "recipient" || f === "issuerOrRecipient") return "recipientName";
    const allowed = ["createdAt", "issueDate", "dueDate", "paidAt", "totalAmount", "amount", "invoiceNumber", "recipientName", "status"];
    return allowed.includes(f) ? f : "createdAt";
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("view", "summary");
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (direction === "pending") {
        params.set("ingestionStatus", "PENDING_REVIEW");
      } else {
        params.set("direction", direction === "outgoing" ? "OUTGOING" : "INCOMING");
      }
      if (statusFilter === "UNPAID") {
        params.set("statusIn", "ISSUED,APPROVED");
      } else if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (categoryFilter) params.set("expenseCategory", categoryFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      params.set("sortField", toServerSortField(sortField));
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/invoices?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load invoices");
      setInvoices(data?.data || []);
      setTotal(typeof data?.total === "number" ? data.total : (data?.data?.length || 0));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [direction, statusFilter, categoryFilter, searchTerm, sortField, sortDir, offset]);

  // Pending-review tab count — independent of the active page/filters.
  const loadPendingCount = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/invoices?view=summary&ingestionStatus=PENDING_REVIEW&limit=1",
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (res.ok) setPendingReviewCount(typeof data?.total === "number" ? data.total : 0);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadPendingCount(); }, [loadPendingCount]);

  // Debounce free-text search → server param; reset to first page.
  useEffect(() => {
    const id = setTimeout(() => { setSearchTerm(invSearch); }, 300);
    return () => clearTimeout(id);
  }, [invSearch]);

  // Any filter / sort / search change returns to the first page.
  useEffect(() => {
    setOffset(0);
  }, [direction, statusFilter, categoryFilter, searchTerm, sortField, sortDir]);

  // Deep-link: auto-open invoice overlay from ?invoiceId= query param.
  // Use a ref so this only fires once per mount — hot-reloads re-mount the
  // component but the ref resets, while URL params persist, preventing loops.
  useEffect(() => {
    if (!router.isReady) return;
    if (deepLinkConsumed.current) return;
    const qId = router.query.invoiceId;
    if (!qId) return;
    deepLinkConsumed.current = true;
    setOverlayInvoiceId(qId);
    // Immediately strip the param from the URL so the next hot-reload won't retrigger
    const { invoiceId: _omit, ...rest } = router.query;
    router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
  }, [router.isReady, router.query.invoiceId]);

  // Static expense-category list (server filters on the canonical enum).
  const EXPENSE_CATEGORIES = ["MAINTENANCE", "UTILITIES", "CLEANING", "INSURANCE", "TAX", "ADMIN", "CAPEX", "OTHER"];

  // Pagination derived values (page-based for PaginationControls).
  const currentPage = Math.floor(offset / PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilterCount = [
    direction !== "incoming",
    statusFilter !== "ALL",
    !!categoryFilter,
  ].filter(Boolean).length;

  const isUnpaidFilter = statusFilter === "UNPAID";

  /* ─── Actions ─── */

  async function invoiceAction(id, action, body) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invoices/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || `Failed to ${action}`);
      }
      await loadData();
      await loadPendingCount();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisputeConfirm(id, reason) {
    await invoiceAction(id, "dispute", { reason });
    setDisputeInvoiceId(null);
  }

  function getAmount(inv) {
    if (typeof inv.totalAmount === "number") return formatChf(inv.totalAmount);
    if (typeof inv.amount === "number") return formatChf(inv.amount);
    return "—";
  }

  function buildActions(inv) {
    const actions = [];

    // Download PDF
    actions.push({
      label: "↓ Download PDF",
      onClick: () => { window.open(`/api/invoices/${inv.id}/pdf`, "_blank"); },
    });

    // Issue — for DRAFT invoices (manager finalizes before sending)
    if (inv.status === "DRAFT") {
      actions.push({
        label: "▸ Issue",
        className: "text-blue-700 font-medium",
        disabled: actionLoading === inv.id,
        onClick: () => invoiceAction(inv.id, "issue"),
      });
    }

    const isOutgoing = inv.direction === "OUTGOING";

    if (isOutgoing) {
      // Outgoing (rent) invoices: no approval or dispute — just mark paid when money arrives
      if (["ISSUED", "APPROVED"].includes(inv.status)) {
        actions.push({
          label: "✓ Mark Paid",
          className: "text-green-700 font-medium",
          disabled: actionLoading === inv.id,
          onClick: () => invoiceAction(inv.id, "mark-paid"),
        });
      }
    } else {
      // Incoming (cost/contractor) invoices: approve → mark paid, with dispute option
      if (inv.status === "ISSUED") {
        actions.push({
          label: "✓ Approve",
          className: "text-green-700 font-medium",
          disabled: actionLoading === inv.id,
          onClick: () => invoiceAction(inv.id, "approve"),
        });
      }
      if (inv.status === "APPROVED") {
        actions.push({
          label: "✓ Mark Paid",
          className: "text-green-700 font-medium",
          disabled: actionLoading === inv.id,
          onClick: () => invoiceAction(inv.id, "mark-paid"),
        });
      }
      if (["ISSUED", "APPROVED"].includes(inv.status)) {
        actions.push({
          label: "✗ Dispute",
          className: "text-red-600 font-medium",
          disabled: actionLoading === inv.id,
          onClick: () => setDisputeInvoiceId(inv.id),
        });
      }
    }

    return actions;
  }

  const invoiceColumns = useMemo(() => [
    {
      id: "status",
      label: t("manager:financeInvoices.col.status"),
      sortable: true,
      defaultVisible: true,
      render: (inv) => (
        <div className="flex items-center flex-wrap gap-1">
          {!isOutgoing && <SourceChannelIcon channel={inv.sourceChannel} />}
          <StatusBadge status={inv.status} />
          <IngestionBadge ingestionStatus={inv.ingestionStatus} />
        </div>
      ),
    },
    {
      id: "invoiceNumber",
      label: t("manager:financeInvoices.col.invoice"),
      sortable: true,
      defaultVisible: true,
      className: "cell-bold",
      render: (inv) => inv.invoiceNumber || inv.id.slice(0, 8),
    },
    {
      id: "issuerOrRecipient",
      label: isOutgoing ? t("manager:financeInvoices.col.tenant") : t("manager:financeInvoices.col.issuer"),
      sortable: true,
      sortField: isOutgoing ? "recipient" : "issuer",
      defaultVisible: true,
      render: (inv) => isOutgoing ? (inv.recipientName || "\u2014") : (inv.issuerName || "\u2014"),
    },
    {
      id: "building",
      label: t("manager:financeInvoices.col.buildingu00b7Unit"),
      sortable: true,
      defaultVisible: true,
      render: (inv) =>
        inv.buildingName || inv.unitNumber
          ? <span>{inv.buildingName || "\u2014"}{inv.unitNumber ? <span className="text-foreground-dim"> · {inv.unitNumber}</span> : null}</span>
          : "\u2014",
    },
    {
      id: "amount",
      label: t("manager:financeInvoices.col.amount"),
      sortable: true,
      defaultVisible: true,
      render: (inv) => getAmount(inv),
    },
    {
      id: "createdAt",
      label: t("manager:financeInvoices.col.date"),
      sortable: true,
      defaultVisible: true,
      render: (inv) => {
        if (!inv.createdAt) return "—";
        const d = new Date(inv.createdAt);
        if (isNaN(d.getTime())) return inv.createdAt;
        const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
        const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return (
          <span>
            {date} <span className="text-foreground-dim text-xs">{time}</span>
          </span>
        );
      },
    },
    {
      id: "recurring",
      label: t("manager:financeInvoices.col.recurring"),
      sortable: true,
      defaultVisible: true,
      render: (inv) => {
        const isRecurring = !!(inv.billingScheduleId || inv.contractorBillingScheduleId);
        return isRecurring
          ? <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-semibold">{t("manager:financeInvoices.text.recurring")}</span>
          : <span className="text-foreground-dim text-xs">—</span>;
      },
    },
    {
      id: "category",
      label: t("manager:financeInvoices.col.category"),
      sortable: true,
      defaultVisible: true,
      render: (inv) =>
        inv.expenseCategory
          ? <span className="text-xs text-muted-text">{inv.expenseCategory.charAt(0) + inv.expenseCategory.slice(1).toLowerCase()}</span>
          : inv.description
            ? <span className="text-xs text-muted-text block max-w-[220px] truncate" title={inv.description}>{inv.description}</span>
            : <span className="text-foreground-dim text-xs">—</span>,
    },
    {
      id: "actions",
      label: t("manager:financeInvoices.col.actions"),
      sortable: false,
      alwaysVisible: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (inv) => <ActionDropdown actions={buildActions(inv)} />,
    },
  ], [isOutgoing, actionLoading]);

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-red-700"><strong>{t("manager:financeInvoices.text.error")}</strong> {error}</span>
          <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">{t("manager:financeInvoices.text.dismiss")}</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="search"
          placeholder={t("manager:financeInvoices.placeholder.searchInvoices")}
          value={invSearch}
          onChange={(e) => { setInvSearch(e.target.value); }}
          className="filter-input flex-1 min-w-0 mb-0"
        />
        {/* Filter button */}
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeFilterCount} />
        {/* Sort cycle button */}
        <button
          onClick={cycleSort}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-muted-text hover:bg-surface-subtle transition-colors"
          title={t("manager:financeInvoices.title.cycleSortField")}
        >
          {INV_SORT_CYCLE[sortCycleIdx].label}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={cn("w-3 h-3 transition-transform", sortDir === "desc" && "rotate-180")} aria-hidden="true">
            <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
          </svg>
        </button>
        {/* Actions dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setActionsOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
          >
            Actions
            <svg xmlns="http://www.w3.org/2000/svg" className={cn("w-3 h-3 transition-transform", actionsOpen && "rotate-180")} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {actionsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-surface-border bg-surface shadow-lg py-1">
                {direction === "outgoing" && (
                  <Link
                    href="/manager/finance/invoices/new"
                    onClick={() => setActionsOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-dark hover:bg-surface-subtle no-underline"
                  >
                    + New Invoice
                  </Link>
                )}
                {direction !== "outgoing" && (
                  <>
                    <button
                      onClick={() => { setActionsOpen(false); setShowUploadModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-dark hover:bg-surface-subtle text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-foreground-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>{t("manager:financeInvoices.heading.uploadInvoice")}</button>
                    <button
                      onClick={() => { setActionsOpen(false); setShowCaptureModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-dark hover:bg-surface-subtle text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-foreground-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      Capture with Phone
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {filterOpen && (
        <FilterPanelBody>
          <FilterSection title={t("manager:financeInvoices.title.direction")} first>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "incoming", label: "Incoming" },
                { key: "outgoing", label: "Outgoing" },
                { key: "pending",  label: pendingReviewCount ? `Pending (${pendingReviewCount})` : "Pending" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setDirection(key); setStatusFilter("ALL"); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    direction === key
                      ? "bg-brand text-white border-brand"
                      : "bg-surface text-muted-text border-surface-border hover:bg-surface-subtle"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection title={t("manager:financeInvoices.title.status")}>
            <div className="flex flex-wrap gap-2">
              {(isOutgoing ? OUTGOING_STATUS_TABS : INCOMING_STATUS_TABS).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setStatusFilter(key); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    statusFilter === key
                      ? key === "UNPAID" ? "bg-amber-500 text-white border-amber-500" : "bg-brand text-white border-brand"
                      : "bg-surface text-muted-text border-surface-border hover:bg-surface-subtle"
                  )}
                >
                  {label ?? key}
                </button>
              ))}
            </div>
          </FilterSection>
          {!isPending && (
            <FilterSection title={t("manager:financeInvoices.title.category")}>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setCategoryFilter(""); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    !categoryFilter
                      ? "bg-brand text-white border-brand"
                      : "bg-surface text-muted-text border-surface-border hover:bg-surface-subtle"
                  )}
                >{t("manager:financeInvoices.text.all")}</button>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                      categoryFilter === cat
                        ? "bg-brand text-white border-brand"
                        : "bg-surface text-muted-text border-surface-border hover:bg-surface-subtle"
                    )}
                  >
                    {cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}
          <FilterSectionClear
            hasFilter={activeFilterCount > 0}
            onClear={() => { setDirection("incoming"); setStatusFilter("ALL"); setCategoryFilter(""); }}
          />
        </FilterPanelBody>
      )}

      {loading ? (
        <Panel><p className="loading-text">{t("manager:financeInvoices.text.loadingInvoices")}</p></Panel>
      ) : invoices.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">{t("manager:financeInvoices.text.noInvoicesMatchThisFilter")}</p></div>
      ) : (
        <>
          {/* Mobile: clean card list (no Panel wrapper) */}
          <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="table-card cursor-pointer hover:bg-surface-subtle/80 transition-colors"
                onClick={() => router.push(`/manager/finance/invoices/${inv.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-muted">{inv.invoiceNumber || inv.id?.slice(0, 8)}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="table-card-head mt-1">{inv.buildingName || "—"}{inv.unitNumber ? ` / ${inv.unitNumber}` : ""}</p>
                <div className="table-card-footer">
                  <span className="font-medium">{formatChf(inv.totalAmount ?? inv.amount)}</span>
                  <span>{formatDate(inv.createdAt)}</span>
                </div>
              </div>
            ))}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setOffset(p * PAGE_SIZE)}
            />
          </div>

          {/* Desktop: Panel + ConfigurableTable */}
          <div className="hidden sm:block">
              <ConfigurableTable
                tableId="manager-invoices"
                columns={invoiceColumns}
                data={invoices}
                rowKey="id"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(inv) => router.push(`/manager/finance/invoices/${inv.id}`)}
                emptyState="No invoices match this filter."
              />
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setOffset(p * PAGE_SIZE)}
              />
          </div>
        </>
      )}

      {/* Invoice PDF Overlay */}
      <InvoiceOverlay
        invoiceId={overlayInvoiceId}
        onClose={() => setOverlayInvoiceId(null)}
      />

      {/* Dispute Justification Modal */}
      {disputeInvoiceId && (
        <DisputeModal
          invoiceId={disputeInvoiceId}
          onConfirm={handleDisputeConfirm}
          onCancel={() => setDisputeInvoiceId(null)}
        />
      )}

      {/* Upload Invoice Modal */}
      {showUploadModal && (
        <UploadInvoiceModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Capture Session (QR) Modal */}
      {showCaptureModal && (
        <CaptureSessionModal
          onClose={() => setShowCaptureModal(false)}
          onComplete={loadData}
        />
      )}
    </>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */

export default function ManagerInvoicesPage() {
  const { t } = useTranslation("manager");
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title={t("manager:financeInvoices.title.invoices")} />
        <PageContent>
          <InvoicesContent />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
