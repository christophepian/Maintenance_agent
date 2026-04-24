import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { ownerAuthHeaders } from "../../lib/api";
import Badge from "../../components/ui/Badge";
import { requestVariant } from "../../lib/statusVariants";

import { cn } from "../../lib/utils";
import ScrollableTabs from "../../components/mobile/ScrollableTabs";
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
  { key: "RFPS",             label: "RFPs",             statuses: null, href: "/owner/approvals?tab=rfps" },
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

function StatusBadge({ status }) {
  return (
    <Badge variant={requestVariant(status)} size="sm">
      {(status || "").replace(/_/g, " ")}
    </Badge>
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
          <ScrollableTabs activeIndex={STATUS_TABS.findIndex((t) => t.key === activeTabKey)}>
            {STATUS_TABS.map((tab) => {
              if (tab.href) {
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className="tab-btn"
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
                  className={isActive ? "tab-btn-active" : "tab-btn"}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={cn("ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold", isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </ScrollableTabs>

          {/* ── Error ── */}
          <ErrorBanner error={error} className="mb-4 text-sm" />

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

          {/* ── List / Table ── */}
          {!loading && filteredRequests.length > 0 && (
            <>
              {/* Mobile: full-width card list */}
              <div className="sm:hidden space-y-3">
                {filteredRequests.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => router.push(`/owner/requests/${r.id}`)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.category || "—"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.buildingName || "—"}{r.unitNumber ? ` / ${r.unitNumber}` : ""}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      {typeof r.estimatedCost === "number" && (
                        <span className="text-xs font-medium text-slate-600">{formatCurrency(r.estimatedCost)}</span>
                      )}
                      <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block">
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
              </div>
            </>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
