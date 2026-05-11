/**
 * ImportedStatementsPanel
 *
 * Embedded in the Finance page "Imports" tab.
 * - Lists imported statements with status badges
 * - Upload PDF modal (file + fiscal year + optional buildingId)
 * - Links to the review/detail page for each statement
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

// ── Status badge variant mapping ──────────────────────────────────────────────

function statusVariant(status) {
  switch (status) {
    case "APPROVED":       return "success";
    case "REJECTED":       return "destructive";
    case "PENDING_REVIEW": return "warning";
    case "PROCESSING":     return "info";
    default:               return "default";
  }
}

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

  // Load buildings for optional picker
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

      const res = await fetch("/api/imported-statements/upload", {
        method: "POST",
        headers: authHeaders(), // no Content-Type — let browser set multipart boundary
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || t("manager:financeImports.text.uploadError"));
      onUploaded(json.data);
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
          <button
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
          >
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
              <p className="text-sm text-slate-500">
                Drop a PDF or image here, or click to select
              </p>
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
            <label className="form-label">
              {t("manager:financeImports.form.fiscalYear")}
            </label>
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
            <label className="form-label">
              {t("manager:financeImports.form.buildingId")}
            </label>
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

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ImportedStatementsPanel() {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const [statements, setStatements] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/imported-statements?limit=50&offset=0", {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load statements");
      setStatements(json.data ?? []);
      setTotal(json.pagination?.total ?? 0);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatements(); }, [fetchStatements]);

  function handleUploaded(statement) {
    setModalOpen(false);
    router.push(`/manager/finance/imports/${statement.id}`);
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
          <button className="button-primary text-sm" onClick={() => setModalOpen(true)}>
            {t("manager:financeImports.action.upload")}
          </button>
        }
      >
        {loading && (
          <p className="loading-text">{t("manager:financeImports.text.loading")}</p>
        )}
        {error && <div className="notice notice-err">{error}</div>}

        {!loading && statements.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-text">{t("manager:financeImports.text.noStatements")}</p>
          </div>
        )}

        {!loading && statements.length > 0 && (
          <>
            {/* Mobile card list */}
            <div className="md:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
              {statements.map((s) => (
                <Link
                  key={s.id}
                  href={`/manager/finance/imports/${s.id}`}
                  className="table-card block hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="table-card-head">{s.buildingName}</span>
                    <Badge variant={statusVariant(s.status)}>
                      {t(`manager:financeImports.status.${s.status}`)}
                    </Badge>
                  </div>
                  <div className="table-card-footer">
                    <span>FY {s.fiscalYear}</span>
                    <span>{formatDate(s.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Wide table */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-table-border">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("manager:financeImports.prop.building")}</th>
                      <th>{t("manager:financeImports.prop.fiscalYear")}</th>
                      <th>{t("manager:financeImports.prop.period")}</th>
                      <th>{t("manager:financeImports.prop.status")}</th>
                      <th className="text-right">Balances</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer hover:bg-slate-50/80"
                        onClick={() => router.push(`/manager/finance/imports/${s.id}`)}
                      >
                        <td className="cell-bold">{s.buildingName}</td>
                        <td>{s.fiscalYear}</td>
                        <td className="text-slate-500 text-sm">
                          {s.periodStart ? formatDate(s.periodStart) : "—"}
                          {s.periodEnd ? ` → ${formatDate(s.periodEnd)}` : ""}
                        </td>
                        <td>
                          <Badge variant={statusVariant(s.status)}>
                            {t(`manager:financeImports.status.${s.status}`)}
                          </Badge>
                        </td>
                        <td className="text-right text-slate-500">
                          {s.accountBalances?.length ?? 0}
                        </td>
                        <td className="text-right">
                          <button
                            aria-label="Review"
                            className="icon-btn"
                            onClick={(e) => { e.stopPropagation(); router.push(`/manager/finance/imports/${s.id}`); }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
