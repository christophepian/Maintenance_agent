import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import { formatDateTime } from "../../lib/format";
import Panel from "../../components/layout/Panel";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusBadge(status) {
  switch (status) {
    case "PENDING":
      return { cls: "bg-amber-100 text-amber-700", label: "Pending" };
    case "SENT":
      return { cls: "bg-green-100 text-green-700", label: "Sent" };
    case "FAILED":
      return { cls: "bg-red-100 text-red-700", label: "Failed" };
    default:
      return { cls: "bg-slate-100 text-slate-700", label: status || "—" };
  }
}

function formatDate(isoStr) {
  return formatDateTime(isoStr);
}

export default function DevEmailsPage() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    loadEmails();
  }, [filterStatus]);

  async function loadEmails() {
    setLoading(true);
    setError("");
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/dev/emails${qs}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load emails");
      setEmails(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmailDetail(id) {
    try {
      const res = await fetch(`/api/dev/emails/${id}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load email detail");
      setSelectedEmail(data.data || data);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="📧 Email Outbox (Dev)"
          subtitle="View queued and sent emails — development mode only"
          actions={
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
              <button
                onClick={loadEmails}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          }
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Email list */}
            <div className="lg:col-span-2">
              <Panel title={`${emails.length} Email${emails.length !== 1 ? "s" : ""}`}>
                {loading && <p className="text-sm text-slate-500">Loading…</p>}

                {!loading && emails.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-500">No emails in outbox.</p>
                )}

                {!loading && emails.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {emails.map((email) => {
                      const badge = statusBadge(email.status);
                      const isActive = selectedEmail?.id === email.id;
                      return (
                        <button
                          key={email.id}
                          onClick={() => loadEmailDetail(email.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            isActive ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                                {badge.label}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                {(email.template || "").replace(/_/g, " ")}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{formatDate(email.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-900 truncate">
                            To: {email.toAddress || "—"}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{email.subject || "—"}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            {/* Detail panel */}
            <div>
              <Panel title="Email Detail">
                {!selectedEmail && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Select an email to view details
                  </p>
                )}

                {selectedEmail && (
                  <div className="space-y-4 text-sm">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">Status</label>
                      <p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(selectedEmail.status).cls}`}>
                          {statusBadge(selectedEmail.status).label}
                        </span>
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">Template</label>
                      <p className="font-mono text-slate-700">
                        {(selectedEmail.template || "—").replace(/_/g, " ")}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">To</label>
                      <p className="text-slate-700">{selectedEmail.toAddress || "—"}</p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">Subject</label>
                      <p className="text-slate-700">{selectedEmail.subject || "—"}</p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">Body</label>
                      <div className="mt-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {selectedEmail.bodyText || selectedEmail.bodyHtml || "—"}
                      </div>
                    </div>

                    {selectedEmail.payloadJson && (
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-400">Payload</label>
                        <pre className="mt-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 overflow-x-auto max-h-60">
                          {typeof selectedEmail.payloadJson === "string"
                            ? selectedEmail.payloadJson
                            : JSON.stringify(selectedEmail.payloadJson, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-400">Created</label>
                        <p className="text-xs text-slate-600">{formatDate(selectedEmail.createdAt)}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-400">Sent At</label>
                        <p className="text-xs text-slate-600">{formatDate(selectedEmail.sentAt)}</p>
                      </div>
                    </div>

                    {selectedEmail.errorMessage && (
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-400">Error</label>
                        <p className="text-sm text-red-700">{selectedEmail.errorMessage}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-400">ID</label>
                      <p className="text-xs font-mono text-slate-400">{selectedEmail.id}</p>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
