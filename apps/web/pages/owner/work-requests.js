import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { ownerAuthHeaders } from "../../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { key: "ALL",              label: "All",              statuses: null },
  { key: "PENDING",          label: "Pending Review",   statuses: ["PENDING_REVIEW"] },
  { key: "OWNER_APPROVAL",   label: "Owner Approval",   statuses: ["PENDING_OWNER_APPROVAL"] },
  { key: "RFP_OPEN",         label: "RFP Open",         statuses: ["RFP_PENDING"] },
  { key: "ACTIVE",           label: "Active",           statuses: ["APPROVED", "AUTO_APPROVED", "ASSIGNED", "IN_PROGRESS"] },
  { key: "DONE",             label: "Completed",        statuses: ["COMPLETED", "OWNER_REJECTED"] },
  { key: "RFPS",             label: "RFPs",             statuses: null, href: "/owner/rfps" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(chf) {
  if (typeof chf !== "number") return "—";
  const str = chf.toFixed(0);
  const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
  return `CHF\u00A0${formatted}`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CLASSES = {
  PENDING_REVIEW:          "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_OWNER_APPROVAL:  "bg-rose-50 text-rose-700 border-rose-200",
  RFP_PENDING:             "bg-indigo-50 text-indigo-700 border-indigo-200",
  APPROVED:                "bg-emerald-50 text-emerald-700 border-emerald-200",
  AUTO_APPROVED:           "bg-emerald-50 text-emerald-700 border-emerald-200",
  ASSIGNED:                "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS:             "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED:               "bg-violet-50 text-violet-700 border-violet-200",
  OWNER_REJECTED:          "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }) {
  const cls = STATUS_CLASSES[status] || "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {(status || "").replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OwnerWorkRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Active tab — sync with ?tab= query param
  const activeTabKey = useMemo(() => {
    const raw = (router.query.tab || "ALL").toString().toUpperCase();
    return STATUS_TABS.find((t) => t.key === raw) ? raw : "ALL";
  }, [router.query.tab]);

  const setTab = useCallback(
    (key) => {
      router.replace({ pathname: router.pathname, query: key === "ALL" ? {} : { tab: key.toLowerCase() } }, undefined, { shallow: true });
    },
    [router]
  );

  // Fetch requests with owner auth
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/requests?view=summary&limit=200", {
          headers: ownerAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Failed to load requests");
        setRequests(json?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtered by active tab
  const filteredRequests = useMemo(() => {
    const tab = STATUS_TABS.find((t) => t.key === activeTabKey);
    if (!tab || !tab.statuses) return requests;
    return requests.filter((r) => tab.statuses.includes(r.status));
  }, [requests, activeTabKey]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = {};
    for (const tab of STATUS_TABS) {
      if (!tab.statuses) {
        counts[tab.key] = requests.length;
      } else {
        counts[tab.key] = requests.filter((r) => tab.statuses.includes(r.status)).length;
      }
    }
    return counts;
  }, [requests]);

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Work Requests"
          subtitle="All maintenance requests across your properties"
        />
        <PageContent>
          {/* ── Tab strip (F-UI1) ── */}
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            {STATUS_TABS.map((tab) => {
              if (tab.href) {
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className="px-3 py-2 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors -mb-px"
                  >
                    {tab.label}
                  </Link>
                );
              }
              const isActive = activeTabKey === tab.key;
              const count = tabCounts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setTab(tab.key)}
                  className={[
                    "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                    isActive
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                  ].join(" ")}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <p className="text-sm text-slate-500">Loading requests…</p>
          )}

          {/* ── Empty ── */}
          {!loading && !error && filteredRequests.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500 text-sm">
              No requests found{activeTabKey !== "ALL" ? " for this filter" : ""}.
            </div>
          )}

          {/* ── Table ── */}
          {!loading && filteredRequests.length > 0 && (
            <Panel bodyClassName="p-0">
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Category</th>
                      <th>Building / Unit</th>
                      <th>Status</th>
                      <th className="text-right">Est. Cost</th>
                      <th>Contractor</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium text-slate-900">
                          {r.requestNumber ? `#${r.requestNumber}` : "—"}
                        </td>
                        <td className="text-sm text-slate-700">{r.category || "—"}</td>
                        <td className="text-sm text-slate-700">
                          {r.buildingName || "—"}
                          {r.unitNumber && (
                            <span className="text-slate-400"> / {r.unitNumber}</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-right text-sm font-mono text-slate-700">
                          {formatCurrency(r.estimatedCost)}
                        </td>
                        <td className="text-sm text-slate-600">
                          {r.assignedContractorName || "—"}
                        </td>
                        <td className="text-sm text-slate-500">{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
