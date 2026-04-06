import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import SortableHeader from "../../../components/SortableHeader";
import PaginationControls from "../../../components/PaginationControls";
import { useTableSort, useTablePagination, clientSort } from "../../../lib/tableUtils";
import { authHeaders } from "../../../lib/api";

/* ─── Helpers ─────────────────────────────────────────────── */

const INVOICE_SORT_FIELDS = ["status", "invoiceNumber", "amount", "createdAt", "issuer", "recipient", "building"];

function invoiceFieldExtractor(inv, field) {
  switch (field) {
    case "status": return inv.status ?? "";
    case "invoiceNumber": return inv.invoiceNumber ?? "";
    case "amount": return inv.totalAmount ?? inv.amount ?? -1;
    case "createdAt": return inv.createdAt || "";
    case "issuer": return (inv.issuerName || "").toLowerCase();
    case "recipient": return (inv.recipientName || "").toLowerCase();
    case "building": return ((inv.buildingName || "") + (inv.unitNumber || "")).toLowerCase();
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

/* ─── StatusBadge (Tailwind) ──────────────────────────────── */

const STATUS_CLS = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-green-100 text-green-800",
  DISPUTED: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " + (STATUS_CLS[status] || "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

/* ─── Ingestion badges & source icons ─────────────────────── */

const INGESTION_CLS = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  AUTO_CONFIRMED: "bg-green-100 text-green-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};
const INGESTION_LABEL = {
  PENDING_REVIEW: "Needs review",
  AUTO_CONFIRMED: "Auto-confirmed",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

function IngestionBadge({ ingestionStatus }) {
  if (!ingestionStatus) return null;
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ml-1.5 " + (INGESTION_CLS[ingestionStatus] || "bg-slate-100 text-slate-600")}>
      {INGESTION_LABEL[ingestionStatus] || ingestionStatus}
    </span>
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
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!invoiceId) return;
    setPdfUrl(null);
    setDetail(null);
    setLoadError("");

    // Fetch the full invoice detail for header info
    fetch(`/api/invoices/${invoiceId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d?.data) setDetail(d.data); })
      .catch(() => {});

    // Fetch the PDF as a blob for the embedded viewer
    fetch(`/api/invoices/${invoiceId}/pdf`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("PDF not available");
        return r.blob();
      })
      .then((blob) => setPdfUrl(URL.createObjectURL(blob)))
      .catch((e) => setLoadError(e.message || "Failed to load PDF"));

    return () => {
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
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
        className="relative flex flex-col bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{ height: "85vh" }}
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
          {loadError ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">{loadError}</p>
            </div>
          ) : !pdfUrl ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Loading PDF…</p>
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              title="Invoice PDF"
              className="w-full h-full border-0"
            />
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
          <button type="submit" disabled={!file || uploading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
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
            <p className="text-sm font-medium text-emerald-700 mb-1">Photos received!</p>
            <p className="text-xs text-slate-500 mb-4">The invoice is being processed.</p>
            <button onClick={onClose} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">Done</button>
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

  // Dispute modal state
  const [disputeInvoiceId, setDisputeInvoiceId] = useState(null);

  // Upload & capture modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);

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

  // Apply status + category filters on top of direction
  const filteredInvoices = useMemo(() => {
    let list = directionFiltered;
    if (statusFilter !== "ALL") {
      list = list.filter((inv) => inv.status === statusFilter);
    }
    if (categoryFilter) {
      list = list.filter((inv) => inv.expenseCategory === categoryFilter);
    }
    return list;
  }, [directionFiltered, statusFilter, categoryFilter]);

  // Unique expense categories across all invoices for the filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set();
    directionFiltered.forEach((inv) => { if (inv.expenseCategory) cats.add(inv.expenseCategory); });
    return [...cats].sort();
  }, [directionFiltered]);

  const [tableExpanded, setTableExpanded] = useState(false);

  const { sortField, sortDir, handleSort } = useTableSort(router, INVOICE_SORT_FIELDS);
  const sortedInvoices = useMemo(
    () => clientSort(filteredInvoices, sortField, sortDir, invoiceFieldExtractor),
    [filteredInvoices, sortField, sortDir]
  );
  const pager = useTablePagination(router, sortedInvoices.length, 25);
  const pageInvoices = useMemo(
    () => pager.pageSlice(sortedInvoices),
    [sortedInvoices, pager.pageSlice]
  );

  const COLLAPSED_ROWS = 5;
  const visibleInvoices = tableExpanded ? pageInvoices : sortedInvoices.slice(0, COLLAPSED_ROWS);

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
        className: "text-emerald-700 font-medium",
        disabled: actionLoading === inv.id,
        onClick: () => invoiceAction(inv.id, "approve"),
      });
    }

    // Mark Paid — for APPROVED invoices
    if (inv.status === "APPROVED") {
      actions.push({
        label: "✓ Mark Paid",
        className: "text-emerald-700 font-medium",
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

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
          <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">Dismiss</button>
        </div>
      )}

      {/* Top bar: direction toggle + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 my-4">
        {/* Direction toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-0.5">
          {[
            { key: "incoming", label: "Incoming" },
            { key: "outgoing", label: "Outgoing" },
            { key: "pending", label: `Pending Review${pendingReviewCount ? ` (${pendingReviewCount})` : ""}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setDirection(key); setTableExpanded(false); }}
              className={[
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                direction === key
                  ? key === "pending"
                    ? "bg-amber-50 text-amber-800 shadow-sm"
                    : "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {direction === "outgoing" && (
            <Link
              href="/manager/finance/invoices/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition no-underline"
            >
              + New Invoice
            </Link>
          )}
          {direction !== "outgoing" && (
            <>
              <button
                onClick={() => setShowUploadModal(true)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                🖥 Upload Invoice
              </button>
              <button
                onClick={() => setShowCaptureModal(true)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                📷 Capture with Phone
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status sub-tabs + category filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 gap-0.5">
          {(isOutgoing ? OUTGOING_STATUS_TABS : INCOMING_STATUS_TABS).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setTableExpanded(false); }}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {availableCategories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setTableExpanded(false); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 bg-white"
          >
            <option value="">All categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-400">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <Panel><p className="loading-text">Loading invoices…</p></Panel>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">No invoices match this filter.</p></div>
      ) : (
        <Panel bodyClassName="p-0">
          <table className="inline-table">
            <thead>
              <tr>
                <SortableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Invoice #" field="invoiceNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label={isOutgoing ? "Tenant" : "Issuer"} field={isOutgoing ? "recipient" : "issuer"} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Building · Unit" field="building" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Created" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th>Recurring</th>
                <th>Category</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((inv) => {
                const isRecurring = !!(inv.billingScheduleId || inv.contractorBillingScheduleId);
                return (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/manager/finance/invoices/${inv.id}`)}
                  className="cursor-pointer"
                >
                  <td>
                    <div className="flex items-center flex-wrap gap-1">
                      {!isOutgoing && <SourceChannelIcon channel={inv.sourceChannel} />}
                      <StatusBadge status={inv.status} />
                      <IngestionBadge ingestionStatus={inv.ingestionStatus} />
                    </div>
                  </td>
                  <td className="cell-bold">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                  <td>{isOutgoing ? (inv.recipientName || "—") : (inv.issuerName || "—")}</td>
                  <td>
                    {inv.buildingName || inv.unitNumber
                      ? <span>{inv.buildingName || "—"}{inv.unitNumber ? <span className="text-slate-400"> · {inv.unitNumber}</span> : null}</span>
                      : "—"}
                  </td>
                  <td>{getAmount(inv)}</td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>
                    {isRecurring
                      ? <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">Recurring</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td>
                    {inv.expenseCategory
                      ? <span className="text-xs text-slate-600">{inv.expenseCategory.charAt(0) + inv.expenseCategory.slice(1).toLowerCase()}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="text-right">
                    <ActionDropdown actions={buildActions(inv)} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {/* Expand / collapse row */}
          <div
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors text-sm text-slate-500 select-none"
            onClick={() => setTableExpanded((e) => !e)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 transition-transform duration-200 ${tableExpanded ? "rotate-180" : ""}`}
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
        </Panel>
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
