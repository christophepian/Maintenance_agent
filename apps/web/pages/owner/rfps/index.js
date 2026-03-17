import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { ownerAuthHeaders } from "../../../lib/api";

const STATUS_COLORS = {
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  AWARDED: "bg-green-50 text-green-700 border-green-200",
  PENDING_OWNER_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-slate-50 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        STATUS_COLORS[status] || "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {status?.replace(/_/g, " ") || "—"}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH");
}

export default function OwnerRfpsPage() {
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/rfps", { headers: ownerAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to load RFPs");
        setRfps(data?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pendingApproval = rfps.filter((r) => r.status === "PENDING_OWNER_APPROVAL");
  const otherRfps = rfps.filter((r) => r.status !== "PENDING_OWNER_APPROVAL");

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="RFPs"
          subtitle="Request for Proposals overview"
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              {pendingApproval.length > 0 && (
                <Panel title={`🔔 Awaiting Your Approval (${pendingApproval.length})`} bodyClassName="p-0">
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>RFP</th>
                        <th>Category</th>
                        <th>Building</th>
                        <th>Quotes</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApproval.map((r) => (
                        <tr key={r.id}>
                          <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                          <td>{r.category || "—"}</td>
                          <td>{r.building?.name || "—"}</td>
                          <td>{r.quoteCount ?? r.quotes?.length ?? 0}</td>
                          <td><StatusPill status={r.status} /></td>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>
                            <Link
                              href={`/owner/rfps/${r.id}`}
                              className="text-sm font-medium text-indigo-600 hover:underline"
                            >
                              Review →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}

              <Panel title={`All RFPs (${rfps.length})`} bodyClassName="p-0">
                {rfps.length > 0 ? (
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>RFP</th>
                        <th>Category</th>
                        <th>Building</th>
                        <th>Quotes</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfps.map((r) => (
                        <tr key={r.id}>
                          <td className="font-mono text-xs">{r.id?.slice(0, 8)}</td>
                          <td>{r.category || "—"}</td>
                          <td>{r.building?.name || "—"}</td>
                          <td>{r.quoteCount ?? r.quotes?.length ?? 0}</td>
                          <td><StatusPill status={r.status} /></td>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>
                            <Link
                              href={`/owner/rfps/${r.id}`}
                              className="text-sm font-medium text-indigo-600 hover:underline"
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No RFPs found.
                  </p>
                )}
              </Panel>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
