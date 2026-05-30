import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import Panel from "./layout/Panel";
import { Dialog, DialogContent } from "./ui/Dialog";
import { authHeaders } from "../lib/api";
import { Eye, Download } from "lucide-react";

/**
 * Reusable panel for displaying corroborative documents from a rental application.
 * Fetches applicants + attachments from the rental-applications/:id/documents endpoint.
 *
 * Props:
 *   applicationId: string  — the rental application ID
 *   title?: string         — panel title (defaults to "Corroborative Documents")
 *   compact?: boolean      — if true, uses smaller styling
 */

const DOC_TYPE_LABELS = {
  IDENTITY: "Identity document",
  PASSPORT: "Passport",
  ID_CARD: "ID card",
  SALARY: "Salary certificate",
  SALARY_PROOF: "Salary proof",
  DEBT_ENFORCEMENT: "Debt enforcement extract",
  TAX_RETURN: "Tax return",
  EMPLOYER_REFERENCE: "Employer reference",
  RESIDENCE_PERMIT: "Residence permit",
  OTHER: "Other document",
};

const DOC_TYPE_ICONS = {
  IDENTITY: "🪪",
  PASSPORT: "🛂",
  ID_CARD: "🪪",
  SALARY: "💰",
  SALARY_PROOF: "💰",
  DEBT_ENFORCEMENT: "📋",
  TAX_RETURN: "🧾",
  EMPLOYER_REFERENCE: "📄",
  RESIDENCE_PERMIT: "🏠",
  OTHER: "📎",
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mimeIcon(mime) {
  if (mime?.includes("pdf")) return "📄";
  if (mime?.includes("image")) return "🖼️";
  return "📎";
}

export default function DocumentsPanel({ applicationId, title, compact }) {
  const { t } = useTranslation("common");
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState("");
  const [previewName, setPreviewName] = useState("");

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`/api/rental-applications/${applicationId}/documents`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error?.message || "Failed to load documents");
        setApplicants(json.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applicationId]);

  async function fetchBlob(attachmentId) {
    const res = await fetch(`/api/rental-attachments/${attachmentId}/download`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Download failed");
    return res.blob();
  }

  async function openPreview(attachmentId, mime, fileName) {
    try {
      const blob = await fetchBlob(attachmentId);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewMime(mime);
      setPreviewName(fileName);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDownload(attachmentId, fileName) {
    try {
      const blob = await fetchBlob(attachmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewMime("");
    setPreviewName("");
  }

  const totalDocs = applicants.reduce((sum, a) => sum + (a.attachments?.length || 0), 0);

  if (!applicationId) return null;

  return (
    <>
      <Panel title={title || `${t("documents.title")}${totalDocs > 0 ? ` (${totalDocs})` : ""}`}>
        {loading && <p className="text-sm text-muted">{t("documents.loading")}</p>}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && totalDocs === 0 && (
          <div className="text-sm text-muted py-2">
            {t("documents.empty")}
          </div>
        )}

        {!loading && !error && applicants.map((applicant) => {
          if (!applicant.attachments?.length) return null;
          return (
            <div key={applicant.id} className={compact ? "mb-3" : "mb-4"}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                {applicant.firstName} {applicant.lastName}
                <span className="ml-2 text-foreground-dim normal-case font-normal">({applicant.role})</span>
              </div>
              <div className="space-y-1.5">
                {applicant.attachments.map((att) => {
                  const icon = DOC_TYPE_ICONS[att.docType] || "📎";
                  const label = DOC_TYPE_LABELS[att.docType] || att.docType;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-subtle px-3 py-2 hover:bg-surface-hover transition-colors group min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base flex-shrink-0">{icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {label}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {att.fileName} · {formatBytes(att.fileSizeBytes)} · {formatDate(att.uploadedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {(att.mimeType?.includes("pdf") || att.mimeType?.includes("image")) && (
                          <button
                            onClick={() => openPreview(att.id, att.mimeType, att.fileName)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-text bg-surface-hover hover:bg-surface-border transition-colors"
                            title={t("action.view")}
                          >
                            <Eye size={14} className="shrink-0" />
                            {t("action.view")}
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(att.id, att.fileName)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-text bg-surface-hover hover:bg-surface-border transition-colors"
                          title={t("action.download")}
                          aria-label={`Download ${att.fileName}`}
                        >
                          <Download size={14} className="shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>

      {/* Document preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent maxWidth="max-w-4xl" className="rounded-2xl overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-surface-subtle">
            <div className="text-sm font-medium text-foreground truncate">{previewName}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = previewUrl;
                  a.download = previewName;
                  a.click();
                }}
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-muted-text bg-surface-hover hover:bg-surface-border"
              >
                <Download size={14} className="shrink-0" />
                {t("action.download")}
              </button>
              <button
                onClick={closePreview}
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-muted-text bg-surface-hover hover:bg-surface-border"
                aria-label={t("action.close")}
              >
                ✕ {t("action.close")}
              </button>
            </div>
          </div>
          <div className="overflow-auto max-h-[calc(90vh-56px)]">
            {previewMime?.includes("pdf") ? (
              <iframe
                src={previewUrl}
                className="w-full h-[80vh] border-0"
                title="Document preview"
              />
            ) : previewMime?.includes("image") ? (
              <div className="flex items-center justify-center p-4 bg-surface-hover">
                <img
                  src={previewUrl}
                  alt={previewName}
                  className="max-w-full max-h-[80vh] object-contain rounded"
                />
              </div>
            ) : (
              <div className="p-8 text-center text-muted">
                <p>{t("documents.previewUnavailable")}</p>
                <a href={previewUrl} download={previewName} className="text-indigo-600 hover:underline mt-2 inline-block">
                  {t("documents.downloadInstead")}
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
