import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import { formatDateTime } from "../../lib/format";
import { tenantFetch, tenantHeaders } from "../../lib/api";

const STATUS_COLORS = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  PENDING_OWNER_APPROVAL: "bg-purple-100 text-purple-800",
  AUTO_APPROVED: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  RFP_PENDING: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-200 text-blue-900",
  COMPLETED: "bg-gray-100 text-gray-800",
  OWNER_REJECTED: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// Tenant Photos / Attachments Panel
// ---------------------------------------------------------------------------

function TenantPhotosPanel({ requestId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tenantFetch(`/api/tenant-portal/maintenance-attachments/${requestId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not available");
        const body = await res.json();
        if (!cancelled) setAttachments(body?.data || []);
      })
      .catch(() => { if (!cancelled) setAttachments([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId]);

  function handleUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;
    const uploads = Array.from(files).map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await tenantFetch(
        `/api/tenant-portal/maintenance-attachments/${requestId}`,
        { method: "POST", body: fd },
      );
      if (!res.ok) throw new Error("Upload failed");
      const body = await res.json();
      return body?.data;
    });
    Promise.all(uploads)
      .then((newItems) => setAttachments((prev) => [...prev, ...newItems.filter(Boolean)]))
      .catch(() => alert("One or more uploads failed"))
      .finally(() => { e.target.value = ""; });
  }

  function isImage(name) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name || "");
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function downloadUrl(a) {
    return `/api/tenant-portal/maintenance-attachments/${a.id}/download`;
  }

  if (loading) return <p className="text-xs text-gray-400 mt-2">Loading photos…</p>;

  const images = attachments.filter((a) => isImage(a.filename));
  const fileList = attachments.filter((a) => !isImage(a.filename));

  return (
    <div className="mt-3">
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-center">
          <p className="text-xs text-gray-400 mb-2">No photos yet</p>
          <label className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            Upload photo
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      ) : (
        <>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((a, i) => (
                <button key={i} onClick={() => setPreviewUrl(downloadUrl(a))} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img src={downloadUrl(a)} alt={a.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </button>
              ))}
            </div>
          )}

          {fileList.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {fileList.map((a, i) => (
                <a key={i} href={downloadUrl(a)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs hover:bg-gray-50">
                  <span className="font-medium text-gray-700">{a.filename}</span>
                  {a.size && <span className="text-gray-400">{formatSize(a.size)}</span>}
                </a>
              ))}
            </div>
          )}

          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            + Upload more
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
          </label>
        </>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Preview" className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" />
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100">
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TenantRequestsPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selfPayLoading, setSelfPayLoading] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tenantSession");
    if (!raw) { setLoading(false); router.push("/tenant"); return; }
    try { setSession(JSON.parse(raw)); } catch { setLoading(false); router.push("/tenant"); }
  }, [router]);

  const fetchRequests = useCallback(async () => {
    if (!session?.tenant?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await tenantFetch("/api/tenant-portal/requests");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Failed to load requests");
        return;
      }
      setRequests(data.data || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleSelfPay(requestId) {
    setSelfPayLoading(requestId);
    setError(null);
    try {
      const res = await tenantFetch(`/api/tenant-portal/requests/${requestId}/self-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || "Failed to accept self-pay");
        return;
      }
      fetchRequests();
    } catch (err) {
      setError(String(err));
    } finally {
      setSelfPayLoading(null);
    }
  }

  if (!session) {
    return (
      <AppShell role="TENANT">
        <div className="main-container max-w-3xl">
          <h1 className="text-2xl font-bold mb-6">My Requests</h1>
          <div className="card p-8 text-center">
            <p className="text-gray-500">Please sign in to view your requests.</p>
            <button
              onClick={() => router.push("/tenant")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Sign in
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role="TENANT">
      <div className="main-container max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">My Maintenance Requests</h1>

        {error && <div className="notice notice-err mb-4">{error}</div>}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-400 text-lg mb-2">📋</p>
            <p className="text-gray-500">No maintenance requests found</p>
            <p className="text-gray-400 text-sm mt-1">
              Submit a work request to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="card p-4 border">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.requestNumber ? <span className="text-gray-500 font-mono">#{r.requestNumber}</span> : null}
                      {r.requestNumber ? " " : ""}{r.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                      {r.payingParty === "TENANT" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                          Self-pay
                        </span>
                      )}
                    </div>
                    {r.rejectionReason && r.status === "OWNER_REJECTED" && (
                      <p className="text-xs text-red-600 mt-1">
                        Reason: {r.rejectionReason}
                      </p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {r.buildingName && <span>{r.buildingName}</span>}
                      {r.unitNumber && <span>Unit {r.unitNumber}</span>}
                      {r.category && <span>{r.category}</span>}
                      <span>{formatDateTime(r.createdAt)}</span>
                    </div>
                  </div>

                  {r.status === "OWNER_REJECTED" && (
                    <button
                      onClick={() => handleSelfPay(r.id)}
                      disabled={selfPayLoading === r.id}
                      className="ml-3 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 disabled:opacity-50 flex-shrink-0"
                    >
                      {selfPayLoading === r.id ? "Processing…" : "Proceed at my own expense"}
                    </button>
                  )}
                </div>

                {/* Photos / Attachments */}
                <TenantPhotosPanel requestId={r.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
