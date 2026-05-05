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
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
];

const OUTGOING_STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Sent" },
  { key: "APPROVED", label: "Pending" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
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
  MANUAL: { text: "Manual", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

function SourceChannelIcon({ channel }) {
  if (!channel || !SOURCE_LABEL[channel]) return null;
  const { text, cls } = SOURCE_LABEL[channel];
  return <span title={channel} className={"inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium mr-1 " + cls}>{text}</span>;
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
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                disabled={a.disabled}
                onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition disabled:opacity-40 " + (a.className || "text-slate-700")}
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
  const [pdfUrl, setPdfUrl] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    setPdfUrl(null);
    setDetail(null);

    // Fetch the full invoice detail for header info
    fetch(`/api/invoices/${invoiceId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d?.data) setDetail(d.data); })
      .catch(() => {});

    // Set PDF URL directly — AUTH_OPTIONAL=true in dev; in production auth is
    // handled server-side via the existing session/JWT forwarded by the proxy.
    setPdfUrl(`/api/invoices/${invoiceId}/pdf`);
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
        className="relative flex flex-col bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 m-0">
              Invoice {detail?.invoiceNumber || invoiceId.slice(0, 8)}
            </h2>
            {detail && (
              <p className="text-sm text-slate-500 mt-0.5 mb-0">
                {detail.recipientName} · {formatChf(detail.totalAmount)} · {detail.status}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/invoices/${invoiceId}/pdf`}
              download
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition no-underline"
              onClick={(e) => e.stopPropagation()}
            >
              ↓ Download PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
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
              title="Invoice PDF"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Loading PDF…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Dispute Justification Modal ─────────────────────────── */

function DisputeModal({ invoiceId, onConfirm, onCancel }) {
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900 mt-0 mb-1">Dispute Invoice</h3>
        <p className="text-sm text-slate-500 mt-0 mb-4">
          Provide a justification for disputing this invoice. The contractor will be notified.
        </p>
        <textarea
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={4}
          placeholder="Reason for dispute…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          required
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900 mt-0 mb-1">Upload Invoice</h3>
        <p className="text-sm text-slate-500 mt-0 mb-4">
          Upload a PDF or image of an invoice. It will be scanned and pre-filled automatically.
        </p>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploadError && (
          <p className="text-sm text-red-600 mt-2">{uploadError}</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
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
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mt-0 mb-1">📷 Capture with Phone</h3>
        {creating ? (
          <p className="text-sm text-slate-500">Creating capture session…</p>
        ) : createError ? (
          <div>
            <p className="text-sm text-red-600 mb-3">{createError}</p>
            <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Close</button>
          </div>
        ) : completed ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-green-700 mb-1">Photos received!</p>
            <p className="text-xs text-slate-500 mb-4">The invoice is being processed.</p>
            <button onClick={onClose} className="button-primary text-sm">Done</button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mt-0 mb-4">
              Scan this QR code with your phone to capture a paper invoice.
            </p>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={mobileUrl} size={300} level="L" />
            </div>
            <div className="bg-slate-50 rounded-lg p-2 mb-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Mobile link</p>
              <p className="text-xs text-slate-600 break-all font-mono select-all m-0">{mobileUrl}</p>
            </div>
            <p className="text-[10px] text-slate-400 text-center mb-3">
              Session expires in 15 minutes. Waiting for photos…
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Embeddable invoices content ─────────────────────────── */

export function InvoicesContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [direction, setDirection] = useState("incoming"); // "incoming" | "outgoing" | "pending"
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invoices?view=summary&limit=200", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load invoices");
      setInvoices(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  const isOutgoing = direction === "outgoing";
  const isPending = direction === "pending";

  const pendingReviewCount = useMemo(
    () => invoices.filter((inv) => inv.ingestionStatus === "PENDING_REVIEW").length,
    [invoices]
  );

  const directionFiltered = useMemo(() => {
    if (isPending) {
      return invoices.filter((inv) => inv.ingestionStatus === "PENDING_REVIEW");
    }
    // Use direction field if available, fallback to leaseId heuristic
    return invoices.filter((inv) => {
      if (inv.direction) return isOutgoing ? inv.direction === "OUTGOING" : inv.direction === "INCOMING";
      return isOutgoing ? !!inv.leaseId : !inv.leaseId;
    });
  }, [invoices, isOutgoing, isPending]);

  // Apply status + category + text search filters on top of direction
  const filteredInvoices = useMemo(() => {
    let list = directionFiltered;
    if (statusFilter !== "ALL") {
      list = list.filter((inv) => inv.status === statusFilter);
    }
    if (categoryFilter) {
      list = list.filter((inv) => inv.expenseCategory === categoryFilter);
    }
    const q = invSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((inv) =>
        (inv.invoiceNumber || "").toLowerCase().includes(q) ||
        (inv.issuerName || "").toLowerCase().includes(q) ||
        (inv.recipientName || "").toLowerCase().includes(q) ||
        (inv.buildingName || "").toLowerCase().includes(q) ||
        (inv.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [directionFiltered, statusFilter, categoryFilter, invSearch]);

  // Unique expense categories across all invoices for the filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set();
    directionFiltered.forEach((inv) => { if (inv.expenseCategory) cats.add(inv.expenseCategory); });
    return [...cats].sort();
  }, [directionFiltered]);

  const [tableExpanded, setTableExpanded] = useState(false);

  const INV_SORT_CYCLE = [
    { field: "createdAt", label: "Date" },
    { field: "amount",    label: "Amount" },
    { field: "status",    label: "Status" },
    { field: "invoiceNumber", label: "Invoice #" },
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

  const sortedInvoices = useMemo(
    () => clientSort(filteredInvoices, sortField, sortDir, invoiceFieldExtractor),
    [filteredInvoices, sortField, sortDir]
  );

  const COLLAPSED_ROWS = 5;
  const visibleInvoices = tableExpanded ? sortedInvoices : sortedInvoices.slice(0, COLLAPSED_ROWS);

  const activeFilterCount = [
    direction !== "incoming",
    statusFilter !== "ALL",
    !!categoryFilter,
  ].filter(Boolean).length;

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

    // Approve — for ISSUED invoices
    if (inv.status === "ISSUED") {
      actions.push({
        label: "✓ Approve",
        className: "text-green-700 font-medium",
        disabled: actionLoading === inv.id,
        onClick: () => invoiceAction(inv.id, "approve"),
      });
    }

    // Mark Paid — for APPROVED invoices
    if (inv.status === "APPROVED") {
      actions.push({
        label: "✓ Mark Paid",
        className: "text-green-700 font-medium",
        disabled: actionLoading === inv.id,
        onClick: () => invoiceAction(inv.id, "mark-paid"),
      });
    }

    // Dispute — for ISSUED or APPROVED
    if (["ISSUED", "APPROVED"].includes(inv.status)) {
      actions.push({
        label: "✗ Dispute",
        className: "text-red-600 font-medium",
        disabled: actionLoading === inv.id,
        onClick: () => setDisputeInvoiceId(inv.id),
      });
    }

    return actions;
  }

  const invoiceColumns = useMemo(() => [
    {
      id: "status",
      label: "Status",
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
      label: "Invoice #",
      sortable: true,
      defaultVisible: true,
      className: "cell-bold",
      render: (inv) => inv.invoiceNumber || inv.id.slice(0, 8),
    },
    {
      id: "issuerOrRecipient",
      label: isOutgoing ? "Tenant" : "Issuer",
      sortable: true,
      sortField: isOutgoing ? "recipient" : "issuer",
      defaultVisible: true,
      render: (inv) => isOutgoing ? (inv.recipientName || "\u2014") : (inv.issuerName || "\u2014"),
    },
    {
      id: "building",
      label: "Building \u00b7 Unit",
      sortable: true,
      defaultVisible: true,
      render: (inv) =>
        inv.buildingName || inv.unitNumber
          ? <span>{inv.buildingName || "\u2014"}{inv.unitNumber ? <span className="text-slate-400"> \u00b7 {inv.unitNumber}</span> : null}</span>
          : "\u2014",
    },
    {
      id: "amount",
      label: "Amount",
      sortable: true,
      defaultVisible: true,
      render: (inv) => getAmount(inv),
    },
    {
      id: "createdAt",
      label: "Date",
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
            {date} <span className="text-slate-400 text-[10px]">{time}</span>
          </span>
        );
      },
    },
    {
      id: "recurring",
      label: "Recurring",
      sortable: true,
      defaultVisible: true,
      render: (inv) => {
        const isRecurring = !!(inv.billingScheduleId || inv.contractorBillingScheduleId);
        return isRecurring
          ? <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">Recurring</span>
          : <span className="text-slate-300 text-xs">\u2014</span>;
      },
    },
    {
      id: "category",
      label: "Category",
      sortable: true,
      defaultVisible: true,
      render: (inv) =>
        inv.expenseCategory
          ? <span className="text-xs text-slate-600">{inv.expenseCategory.charAt(0) + inv.expenseCategory.slice(1).toLowerCase()}</span>
          : <span className="text-slate-300 text-xs">\u2014</span>,
    },
    {
      id: "actions",
      label: "Actions",
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
          <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
          <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">Dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="search"
          placeholder="Search invoices…"
          value={invSearch}
          onChange={(e) => { setInvSearch(e.target.value); setTableExpanded(false); }}
          className="filter-input flex-1 min-w-0 mb-0"
        />
        {/* Filter button */}
        <FilterToggle open={filterOpen} onToggle={() => setFilterOpen((v) => !v)} activeCount={activeFilterCount} />
        {/* Sort cycle button */}
        <button
          onClick={cycleSort}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          title="Cycle sort field"
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
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                {direction === "outgoing" && (
                  <Link
                    href="/manager/finance/invoices/new"
                    onClick={() => setActionsOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 no-underline"
                  >
                    + New Invoice
                  </Link>
                )}
                {direction !== "outgoing" && (
                  <>
                    <button
                      onClick={() => { setActionsOpen(false); setShowUploadModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Upload Invoice
                    </button>
                    <button
                      onClick={() => { setActionsOpen(false); setShowCaptureModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
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
          <FilterSection title="Direction" first>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "incoming", label: "Incoming" },
                { key: "outgoing", label: "Outgoing" },
                { key: "pending",  label: pendingReviewCount ? `Pending (${pendingReviewCount})` : "Pending" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setDirection(key); setStatusFilter("ALL"); setTableExpanded(false); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    direction === key
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection title="Status">
            <div className="flex flex-wrap gap-2">
              {(isOutgoing ? OUTGOING_STATUS_TABS : INCOMING_STATUS_TABS).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setStatusFilter(key); setTableExpanded(false); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    statusFilter === key
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterSection>
          {availableCategories.length > 0 && (
            <FilterSection title="Category">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setCategoryFilter(""); setTableExpanded(false); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                    !categoryFilter
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >All</button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setTableExpanded(false); }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                      categoryFilter === cat
                        ? "bg-brand text-white border-brand"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
        <Panel><p className="loading-text">Loading invoices…</p></Panel>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">No invoices match this filter.</p></div>
      ) : (
        <>
          {/* Mobile: clean card list (no Panel wrapper) */}
          <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
            {visibleInvoices.map((inv) => (
              <div
                key={inv.id}
                className="table-card cursor-pointer hover:bg-slate-50/80 transition-colors"
                onClick={() => router.push(`/manager/finance/invoices/${inv.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{inv.invoiceNumber || inv.id?.slice(0, 8)}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="table-card-head mt-1">{inv.buildingName || "—"}{inv.unitNumber ? ` / ${inv.unitNumber}` : ""}</p>
                <div className="table-card-footer">
                  <span className="font-medium">{formatChf(inv.totalAmount ?? inv.amount)}</span>
                  <span>{formatDate(inv.createdAt)}</span>
                </div>
              </div>
            ))}
            {/* Expand / collapse */}
            <div
              className="expand-footer"
              onClick={() => setTableExpanded((e) => !e)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className={cn("w-4 h-4 transition-transform duration-200", tableExpanded ? "rotate-180" : "")}>
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              {tableExpanded ? "Show less" : `Show all ${sortedInvoices.length} invoice${sortedInvoices.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* Desktop: Panel + ConfigurableTable */}
          <div className="hidden sm:block">
              <ConfigurableTable
                tableId="manager-invoices"
                columns={invoiceColumns}
                data={visibleInvoices}
                rowKey="id"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(inv) => router.push(`/manager/finance/invoices/${inv.id}`)}
                emptyState="No invoices match this filter."
              />
              {/* Expand / collapse row */}
              <div
                className="expand-footer"
                onClick={() => setTableExpanded((e) => !e)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={cn("w-4 h-4 transition-transform duration-200", tableExpanded ? "rotate-180" : "")}
                >
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
                {tableExpanded
                  ? "Show less"
                  : `Show all ${sortedInvoices.length} invoice${sortedInvoices.length !== 1 ? "s" : ""}`}
              </div>
              {tableExpanded && (
                <PaginationControls
                  currentPage={pager.currentPage}
                  totalPages={pager.totalPages}
                  totalItems={sortedInvoices.length}
                  pageSize={pager.pageSize}
                  onPageChange={pager.setPage}
                />
              )}
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
  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Invoices" />
        <PageContent>
          <InvoicesContent />
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","manager"]);
