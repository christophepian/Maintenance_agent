import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel.jsx";
import ContractorPicker from "../../components/ContractorPicker";
import ErrorBanner from "../../components/ui/ErrorBanner";
import Badge from "../../components/ui/Badge";
import { invoiceVariant, ingestionVariant } from "../../lib/statusVariants";
import { formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "DISPUTED", label: "Disputed" },
];

/* ── Status tracking pipeline ────────────────────────────────── */
const STATUS_PIPELINE = ["DRAFT", "ISSUED", "APPROVED", "PAID"];
function StatusPipeline({ status }) {
  const idx = STATUS_PIPELINE.indexOf(status);
  const isDisputed = status === "DISPUTED";
  return (
    <div className="flex items-center gap-1">
      {STATUS_PIPELINE.map((step, i) => {
        const reached = !isDisputed && i <= idx;
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={
                "h-2 w-2 rounded-full " +
                (reached ? "bg-green-500" : "bg-slate-200")
              }
              title={step}
            />
            {i < STATUS_PIPELINE.length - 1 && (
              <div className={"h-0.5 w-3 " + (reached && i < idx ? "bg-green-400" : "bg-slate-200")} />
            )}
          </div>
        );
      })}
      {isDisputed && (
        <span className="ml-1.5 text-[10px] font-semibold text-rose-600">⚠ DISPUTED</span>
      )}
    </div>
  );
}

/* ── Ingestion helpers ───────────────────────────────────────── */
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
  return <span title={channel} className={"inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ml-1 " + cls}>{text}</span>;
}

/* ── Currency helper ─────────────────────────────────────────── */
function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = safeValue.toFixed(2);
  return `CHF ${formatted}`;
}

function getInvoiceTotal(invoice) {
  if (typeof invoice.totalAmount === "number") return invoice.totalAmount;
  if (typeof invoice.amount === "number") return invoice.amount;
  if (typeof invoice.totalAmountCents === "number") return invoice.totalAmountCents / 100;
  return 0;
}

export default function ContractorInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");

  // Create invoice form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formJobId, setFormJobId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Available jobs for dropdown
  const [availableJobs, setAvailableJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Upload invoice
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Auto-open form when jobId query param present
  useEffect(() => {
    if (router.query.jobId) {
      setFormJobId(router.query.jobId);
      setShowCreateForm(true);
    }
  }, [router.query.jobId]);

  useEffect(() => {
    if (router.query.status) setActiveTab(router.query.status);
  }, [router.query.status]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Fetch available jobs when create form is shown
  useEffect(() => {
    if (showCreateForm && availableJobs.length === 0) {
      fetchJobs();
    }
  }, [showCreateForm]);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const contractorId = localStorage.getItem("contractorId");
      const url = contractorId
        ? `/api/contractor/jobs?contractorId=${contractorId}`
        : "/api/contractor/jobs";
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setAvailableJobs(data.data || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
    setLoadingJobs(false);
  };

  const fetchInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const contractorId = localStorage.getItem("contractorId");
      const url = contractorId
        ? `/api/contractor/invoices?contractorId=${contractorId}`
        : "/api/invoices";
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const submitInvoice = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (!formJobId) { setFormError("Job ID is required"); return; }
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      setFormError("Please enter a valid amount (CHF)");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          jobId: formJobId,
          amount: Number(formAmount),
          description: formDescription || undefined,
          direction: "INCOMING",
          sourceChannel: "MANUAL",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.message || (typeof body.error === "string" ? body.error : body.error?.message) || `Failed to create invoice (${res.status})`;
        throw new Error(msg);
      }
      setFormSuccess("Invoice created successfully!");
      setFormAmount("");
      setFormDescription("");
      setShowCreateForm(false);
      if (router.query.jobId) {
        router.replace("/contractor/invoices", undefined, { shallow: true });
      }
      await fetchInvoices();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("sourceChannel", "BROWSER_UPLOAD");
      formData.append("direction", "INCOMING");
      const res = await fetch("/api/invoices/ingest", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.message || (typeof body.error === "string" ? body.error : body.error?.message) || `Upload failed (${res.status})`;
        throw new Error(msg);
      }
      setShowUpload(false);
      setUploadFile(null);
      await fetchInvoices();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (activeTab === "ALL") return invoices;
    return invoices.filter((inv) => inv.status === activeTab);
  }, [invoices, activeTab]);

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <PageHeader
          title="My Invoices"
          actions={
            <div className="flex items-center gap-2">
              <ContractorPicker onSelect={() => fetchInvoices()} />
              {!showUpload && !showCreateForm && (
                <>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                  >
                    📤 Upload Invoice
                  </button>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    + Create Invoice
                  </button>
                </>
              )}
            </div>
          }
        />
        <PageContent>

        {/* Upload invoice panel */}
        {showUpload && (
          <div className="mb-6 rounded-lg border-2 border-indigo-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">📤 Upload Invoice</h3>
              <button
                onClick={() => { setShowUpload(false); setUploadFile(null); setUploadError(""); }}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              Upload a scanned invoice or PDF. It will be processed with OCR and matched to jobs automatically.
            </p>
            <ErrorBanner error={uploadError} className="mb-3 text-sm" />
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
              >
                {uploading ? "Processing…" : "Upload & Scan"}
              </button>
            </div>
            {uploadFile && (
              <p className="mt-2 text-xs text-slate-500">Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>
        )}

        {showCreateForm && (
          <div className="mb-6 rounded-lg border-2 border-indigo-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Create Invoice</h3>
              <button
                onClick={() => { setShowCreateForm(false); setFormError(""); setFormSuccess(""); }}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>
            <ErrorBanner error={formError} className="mb-3 text-sm" />
            <form onSubmit={submitInvoice} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Job</label>
                {router.query.jobId ? (
                  <input
                    type="text"
                    value={formJobId}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={formJobId}
                    onChange={(e) => setFormJobId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {loadingJobs ? "Loading jobs…" : "Select a job"}
                    </option>
                    {availableJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title || job.description || job.id.slice(0, 8)} — {job.status || ""}
                      </option>
                    ))}
                  </select>
                )}
                {router.query.jobId && (
                  <p className="mt-1 text-xs text-slate-500">Pre-filled from job detail page</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount (CHF)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max="100000"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of work performed"
                  maxLength={500}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={formSubmitting}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {formSubmitting ? "Submitting…" : "Submit Invoice"}
              </button>
            </form>
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {formSuccess}
          </div>
        )}

        <ErrorBanner error={error} onDismiss={() => setError("")} className="mb-4" />

        <Panel bodyClassName="p-0">
          {/* Status Tabs */}
          <div className="tab-strip">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === "ALL"
                ? invoices.length
                : invoices.filter((inv) => inv.status === tab.key).length;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={active ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="p-4 text-sm text-slate-600">Loading invoices…</p>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <p className="text-sm">No invoices match this filter</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/manager/finance/invoices/${invoice.id}`)}
              >
                {/* Left side */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : `#${invoice.id.slice(0, 8)}`}
                    </p>
                    <Badge variant={invoiceVariant(invoice.status)} size="sm">
                      {invoice.status}
                    </Badge>
                    <SourceChannelIcon channel={invoice.sourceChannel} />
                    <IngestionBadge ingestionStatus={invoice.ingestionStatus} />
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <StatusPipeline status={invoice.status} />
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{formatDate(invoice.createdAt)}</span>
                    {invoice.jobId && (
                      <>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">
                          Job {invoice.jobId.slice(0, 8)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="text-base font-bold text-slate-900">
                    {formatCurrency(getInvoiceTotal(invoice))}
                  </p>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      📄
                    </a>
                  </div>
                  <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
            </div>
          )}
        </Panel>

        {/* Summary */}
        {!loading && filteredInvoices.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
            <span>{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
            <span>
              Total: {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0))}
            </span>
          </div>
        )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
