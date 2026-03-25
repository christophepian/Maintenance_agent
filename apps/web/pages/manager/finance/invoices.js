import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
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

const INVOICE_SORT_FIELDS = ["status", "invoiceNumber", "amount", "createdAt"];

function invoiceFieldExtractor(inv, field) {
  switch (field) {
    case "status": return inv.status ?? "";
    case "invoiceNumber": return inv.invoiceNumber ?? "";
    case "amount": return inv.totalAmount ?? inv.amount ?? -1;
    case "createdAt": return inv.createdAt || "";
    default: return "";
  }
}

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
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

/* ─── Main Page ───────────────────────────────────────────── */

export default function ManagerInvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null);

  // Overlay state
  const [overlayInvoiceId, setOverlayInvoiceId] = useState(null);

  // Dispute modal state
  const [disputeInvoiceId, setDisputeInvoiceId] = useState(null);

  useEffect(() => {
    if (router.query.status) setActiveTab(router.query.status);
  }, [router.query.status]);

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

  const filteredInvoices = useMemo(() => {
    if (activeTab === "ALL") return invoices;
    return invoices.filter((inv) => inv.status === activeTab);
  }, [invoices, activeTab]);

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
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Invoices" />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-red-700"><strong>Error:</strong> {error}</span>
              <button onClick={() => setError("")} className="text-xs text-red-500 hover:text-red-700 ml-4">Dismiss</button>
            </div>
          )}

          {/* Status Tabs */}
          <div className="tab-strip">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === "ALL"
                ? invoices.length
                : invoices.filter((inv) => inv.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={activeTab === tab.key ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
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
                    <SortableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Created" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => setOverlayInvoiceId(inv.id)}
                      className="cursor-pointer"
                    >
                      <td><StatusBadge status={inv.status} /></td>
                      <td className="cell-bold">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                      <td>{getAmount(inv)}</td>
                      <td>{formatDate(inv.createdAt)}</td>
                      <td className="text-right">
                        <ActionDropdown actions={buildActions(inv)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls
                currentPage={pager.currentPage}
                totalPages={pager.totalPages}
                totalItems={sortedInvoices.length}
                pageSize={pager.pageSize}
                onPageChange={pager.setPage}
              />
            </Panel>
          )}
        </PageContent>
      </PageShell>

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
    </AppShell>
  );
}
