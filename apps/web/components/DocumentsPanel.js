import { useEffect, useState } from "react";
import Panel from "./layout/Panel";

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
    fetch(`/api/rental-applications/${applicationId}/documents`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error?.message || "Failed to load documents");
        setApplicants(json.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applicationId]);

  function openPreview(attachmentId, mime, fileName) {
    const url = `/api/rental-attachments/${attachmentId}/download`;
    if (mime?.includes("pdf") || mime?.includes("image")) {
      setPreviewUrl(url);
      setPreviewMime(mime);
      setPreviewName(fileName);
    } else {
      // Fallback: just download
      window.open(url, "_blank");
    }
  }

  function closePreview() {
    setPreviewUrl(null);
    setPreviewMime("");
    setPreviewName("");
  }

  const totalDocs = applicants.reduce((sum, a) => sum + (a.attachments?.length || 0), 0);

  if (!applicationId) return null;

  return (
    <>
      <Panel title={title || `Corroborative Documents${totalDocs > 0 ? ` (${totalDocs})` : ""}`}>
        {loading && <p className="text-sm text-slate-500">Loading documents…</p>}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && totalDocs === 0 && (
          <div className="text-sm text-slate-500 py-2">
            No documents uploaded for this application.
          </div>
        )}

        {!loading && !error && applicants.map((applicant) => {
          if (!applicant.attachments?.length) return null;
          return (
            <div key={applicant.id} className={compact ? "mb-3" : "mb-4"}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {applicant.firstName} {applicant.lastName}
                <span className="ml-2 text-slate-400 normal-case font-normal">({applicant.role})</span>
              </div>
              <div className="space-y-1.5">
                {applicant.attachments.map((att) => {
                  const icon = DOC_TYPE_ICONS[att.docType] || "📎";
                  const label = DOC_TYPE_LABELS[att.docType] || att.docType;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base flex-shrink-0">{icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {label}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {att.fileName} · {formatBytes(att.fileSizeBytes)} · {formatDate(att.uploadedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => openPreview(att.id, att.mimeType, att.fileName)}
                          className="rounded px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          title="Preview"
                        >
                          {att.mimeType?.includes("pdf") || att.mimeType?.includes("image") ? "👁 View" : "⬇ Download"}
                        </button>
                        <a
                          href={`/api/rental-attachments/${att.id}/download`}
                          download={att.fileName}
                          className="rounded px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                          title="Download"
                        >
                          ⬇
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>

      {/* Inline preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closePreview}>
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
              <div className="text-sm font-medium text-slate-800 truncate">{previewName}</div>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download={previewName}
                  className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  ⬇ Download
                </a>
                <button
                  onClick={closePreview}
                  className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-56px)]">
              {previewMime?.includes("pdf") ? (
                <iframe
                  src={previewUrl}
                  className="w-full border-0"
                  className="h-[80vh]"
                  title="Document preview"
                />
              ) : previewMime?.includes("image") ? (
                <div className="flex items-center justify-center p-4 bg-slate-100">
                  <img
                    src={previewUrl}
                    alt={previewName}
                    className="max-w-full max-h-[80vh] object-contain rounded"
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <p>Preview not available for this file type.</p>
                  <a href={previewUrl} download={previewName} className="text-indigo-600 hover:underline mt-2 inline-block">
                    Download instead
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
