/**
 * ImportedStatementsPanel
 *
 * Embedded in the Finance page "Imports" tab.
 * - Lists upload batches (one per PDF upload) with nested section statements
 * - Upload PDF modal (file + fiscal year + optional buildingId)
 * - Links to the review/detail page for each section statement
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import Panel from "./layout/Panel";
import Badge from "./ui/Badge";
import { authHeaders } from "../lib/api";
import { formatDate } from "../lib/format";
import { cn } from "../lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status) {
  switch (status) {
    case "APPROVED":       return "success";
    case "REJECTED":       return "destructive";
    case "PENDING_REVIEW": return "warning";
    case "PROCESSING":     return "info";
    default:               return "default";
  }
}

/** Summarise a batch's overall status from its child statements. */
function batchOverallStatus(statements) {
  if (!statements?.length) return "PROCESSING";
  if (statements.every((s) => s.status === "APPROVED")) return "APPROVED";
  if (statements.some((s) => s.status === "PROCESSING")) return "PROCESSING";
  if (statements.some((s) => s.status === "PENDING_REVIEW")) return "PENDING_REVIEW";
  if (statements.every((s) => s.status === "REJECTED")) return "REJECTED";
  return "PENDING_REVIEW";
}

const SECTION_LABEL = {
  BALANCE_SHEET:    "Balance Sheet",
  INCOME_STATEMENT: "Income Statement",
  INVOICES:         "Invoices",
};

// ── Upload Modal ──────────────────────────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: "FINANCIAL_STATEMENT", label: "Financial Statement (balance sheet)" },
  { value: "INVOICE",             label: "Invoice(s)" },
  { value: "",                    label: "Auto-detect" },
];

function UploadModal({ onClose, onUploaded }) {
  const { t } = useTranslation("manager");
  const [file, setFile] = useState(null);
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [buildingId, setBuildingId] = useState("");
  const [hintDocType, setHintDocType] = useState("FINANCIAL_STATEMENT");
  const [buildings, setBuildings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setBuildings(j.data ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fiscalYear", fiscalYear);
      if (buildingId) form.append("buildingId", buildingId);
      if (hintDocType) form.append("hintDocType", hintDocType);

      // Large PDFs exceed Vercel's 4.5 MB serverless-function request-body limit.
      // When NEXT_PUBLIC_BACKEND_URL is set (production), upload directly to the
      // backend to bypass Vercel. In dev (no env var) we go through the Next.js
      // proxy as usual.
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const uploadUrl = backendUrl
        ? `${backendUrl}/imported-statements/upload`
        : "/api/imported-statements/upload";

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: authHeaders(), // no Content-Type — let browser set multipart boundary
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || t("manager:financeImports.text.uploadError"));
      // Upload returns an UploadBatchDTO — navigate to the first section statement
      const batch = json.data;
      const firstStatement = batch.statements?.[0];
      onUploaded(firstStatement ?? batch);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {t("manager:financeImports.action.upload")}
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              file ? "border-brand-ring bg-brand-light" : "border-slate-300 hover:border-slate-400",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/tiff"
              className="hidden"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            {file ? (
              <p className="text-sm text-brand-dark font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-slate-500">Drop a PDF or image here, or click to select</p>
            )}
          </div>

          {/* Document type */}
          <div>
            <label className="form-label">Document type</label>
            <select
              className="form-input w-full"
              value={hintDocType}
              onChange={(e) => setHintDocType(e.target.value)}
            >
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Fiscal year */}
          <div>
            <label className="form-label">{t("manager:financeImports.form.fiscalYear")}</label>
            <input
              type="number"
              min="2000"
              max="2100"
              className="form-input w-full"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              required
            />
          </div>

          {/* Building — optional */}
          <div>
            <label className="form-label">{t("manager:financeImports.form.buildingId")}</label>
            <select
              className="form-input w-full"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
            >
              <option value="">{t("manager:financeImports.form.selectBuilding")}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive-text">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button type="button" className="button-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={!file || uploading}>
              {uploading ? t("manager:financeImports.text.uploading") : t("manager:financeImports.action.upload")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Batch row ─────────────────────────────────────────────────────────────────

function BatchRow({ batch, onDeleted, deletingId, onDelete }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);

  const overallStatus = batchOverallStatus(batch.statements);
  const fileName = batch.fileName || "document.pdf";
  const buildingName = batch.statements?.[0]?.buildingName ?? null;

  return (
    <div className="border border-table-border rounded-lg overflow-hidden">
      {/* Batch header */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150", expanded ? "rotate-90" : "")}
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>

        {/* File icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800 truncate block">{fileName}</span>
          <span className="text-xs text-slate-500">
            {formatDate(batch.createdAt)}
            {buildingName ? ` · ${buildingName}` : ""}
            {" · "}{batch.statements?.length ?? 0} section{batch.statements?.length !== 1 ? "s" : ""}
          </span>
        </div>

        <Badge variant={statusVariant(overallStatus)} className="shrink-0">
          {overallStatus.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Nested section statements */}
      {expanded && (
        <div className="divide-y divide-table-divider">
          {batch.statements?.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-4 py-3 pl-10 hover:bg-slate-50/80 cursor-pointer transition-colors"
              onClick={() => router.push(`/manager/finance/imports/${s.id}`)}
            >
              <span className="text-xs font-medium text-slate-500 w-32 shrink-0">
                {SECTION_LABEL[s.sectionType] ?? s.sectionType}
              </span>
              <span className="text-xs text-slate-400">
                FY {s.fiscalYear}
                {s.accountBalances?.length > 0 ? ` · ${s.accountBalances.length} rows` : ""}
              </span>
              <div className="flex-1" />
              <Badge variant={statusVariant(s.status)}>
                {s.status.replace(/_/g, " ")}
              </Badge>
              <button
                aria-label="Delete section"
                className="icon-btn text-slate-300 hover:text-destructive-text shrink-0"
                disabled={deletingId === s.id || s.status === "APPROVED"}
                title={s.status === "APPROVED" ? "Approved sections cannot be deleted" : "Delete section"}
                onClick={(e) => { e.stopPropagation(); onDelete(s.id, e); }}
              >
                {deletingId === s.id ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                aria-label="Review"
                className="icon-btn"
                onClick={(e) => { e.stopPropagation(); router.push(`/manager/finance/imports/${s.id}`); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile batch card ─────────────────────────────────────────────────────────

function BatchCard({ batch, onDelete, deletingId }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const overallStatus = batchOverallStatus(batch.statements);
  const fileName = batch.fileName || "document.pdf";
  const buildingName = batch.statements?.[0]?.buildingName ?? null;

  return (
    <div className="border-b border-table-divider last:border-b-0">
      {/* Batch header */}
      <div
        className="table-card cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="table-card-head truncate">{fileName}</span>
          <Badge variant={statusVariant(overallStatus)}>
            {overallStatus.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="table-card-footer">
          {buildingName && <span>{buildingName}</span>}
          <span>{formatDate(batch.createdAt)}</span>
          <span>{batch.statements?.length ?? 0} section{batch.statements?.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Section rows */}
      {expanded && batch.statements?.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-2 px-4 py-2.5 pl-8 bg-slate-50/60 border-t border-table-divider cursor-pointer hover:bg-slate-100/60 transition-colors"
          onClick={() => router.push(`/manager/finance/imports/${s.id}`)}
        >
          <span className="flex-1 text-xs font-medium text-slate-600">
            {SECTION_LABEL[s.sectionType] ?? s.sectionType}
          </span>
          <Badge variant={statusVariant(s.status)}>
            {s.status.replace(/_/g, " ")}
          </Badge>
          <button
            aria-label="Delete"
            className="icon-btn text-slate-300 hover:text-destructive-text"
            disabled={deletingId === s.id || s.status === "APPROVED"}
            onClick={(e) => { e.stopPropagation(); onDelete(s.id, e); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ImportedStatementsPanel() {
  const { t } = useTranslation("manager");
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/imported-statements/batches?limit=50&offset=0", {
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error?.message || `Failed to load imports (${res.status})`);
      setBatches(json.data ?? []);
      setTotal(json.pagination?.total ?? 0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  // Total statement count across all batches
  const totalStatements = batches.reduce((sum, b) => sum + (b.statements?.length ?? 0), 0);

  function handleUploaded(statement) {
    setModalOpen(false);
    if (statement?.id) {
      window.location.href = `/manager/finance/imports/${statement.id}`;
    } else {
      fetchBatches();
    }
  }

  async function handleDelete(statementId, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this section? This cannot be undone.")) return;
    setDeletingId(statementId);
    try {
      const res = await fetch(`/api/imported-statements/${statementId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Failed to delete");
      }
      // Remove the section from the local state; drop batch if now empty
      setBatches((prev) =>
        prev
          .map((b) => ({ ...b, statements: (b.statements ?? []).filter((s) => s.id !== statementId) }))
          .filter((b) => b.statements.length > 0),
      );
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm(`Delete all ${totalStatements} imported statements? This cannot be undone.`)) return;
    setDeletingAll(true);
    try {
      const res = await fetch("/api/imported-statements", {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || "Failed to delete statements");
      }
      setBatches([]);
      setTotal(0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <>
      {modalOpen && (
        <UploadModal
          onClose={() => setModalOpen(false)}
          onUploaded={handleUploaded}
        />
      )}

      <Panel
        title={t("manager:financeImports.title.imports")}
        actions={
          <div className="flex gap-2">
            {totalStatements > 0 && (
              <button
                className="button-secondary text-sm text-destructive-text hover:bg-destructive-subtle"
                onClick={handleDeleteAll}
                disabled={deletingAll}
              >
                {deletingAll ? "Deleting…" : "Delete all"}
              </button>
            )}
            <button className="button-primary text-sm" onClick={() => setModalOpen(true)}>
              {t("manager:financeImports.action.upload")}
            </button>
          </div>
        }
      >
        {loading && <p className="loading-text">{t("manager:financeImports.text.loading")}</p>}
        {error && <div className="notice notice-err">{error}</div>}

        {!loading && batches.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-text">{t("manager:financeImports.text.noStatements")}</p>
          </div>
        )}

        {!loading && batches.length > 0 && (
          <>
            {/* Mobile card list */}
            <div className="md:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
              {batches.map((batch) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>

            {/* Wide grouped list */}
            <div className="hidden md:flex flex-col gap-3">
              {batches.map((batch) => (
                <BatchRow
                  key={batch.id}
                  batch={batch}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
