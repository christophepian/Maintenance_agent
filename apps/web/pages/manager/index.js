import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Badge from "../../components/ui/Badge";
import Section from "../../components/layout/Section";
import ErrorBanner from "../../components/ui/ErrorBanner";
import { formatChf as formatCurrency, formatChfCents, formatPercent, formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";
import { cn } from "../../lib/utils";

/* ─── YTD date range ─── */
function ytdRange() {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-01-01`,
    to: now.toISOString().slice(0, 10),
  };
}

/* ─── Health traffic-light dot ─── */
const HEALTH_DOT = {
  green: { bg: "bg-green-500", ring: "ring-green-200" },
  amber: { bg: "bg-amber-500", ring: "ring-amber-200" },
  red:   { bg: "bg-red-500",   ring: "ring-red-200" },
};
function HealthDot({ health }) {
  const c = HEALTH_DOT[health] || HEALTH_DOT.amber;
  return (
    <span className={cn("inline-block w-2.5 h-2.5 rounded-full", c.bg, "ring-2", c.ring)}>
      <span className="sr-only">{health}</span>
    </span>
  );
}

/* ─── Action Items tabs ─── */
const ACTION_TABS = ["Pending review", "Owner approval", "Disputed invoices", "Stale jobs", "RFP routed"];

function ActionItemsTabs({
  pendingReviewRequests,
  pendingOwnerApprovalRequests,
  disputedInvoices,
  staleJobs,
  rfpPendingRequests,
}) {
  const [active, setActive] = useState(0);

  const badges = [
    pendingReviewRequests.length || null,
    pendingOwnerApprovalRequests.length || null,
    disputedInvoices.length || null,
    staleJobs.length || null,
    rfpPendingRequests.length || null,
  ];

  const totalActions = pendingReviewRequests.length + pendingOwnerApprovalRequests.length +
    disputedInvoices.length + staleJobs.length + rfpPendingRequests.length;

  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Action Items</h2>

      {/* Tab strip */}
      <div className="tab-strip">
        {ACTION_TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            className={active === i ? "tab-btn-active" : "tab-btn"}
          >
            {label}
            {badges[i] != null && (
              <span className={cn(
                "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none",
                active === i ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600",
              )}>
                {badges[i]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0 — Pending review */}
      <div className={active === 0 ? "tab-panel-active" : "tab-panel"}>
        {pendingReviewRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No requests pending review.</p>
        ) : (
          <div className="space-y-2">
            {pendingReviewRequests.slice(0, 5).map((req) => (
              <Link key={req.id} href={`/manager/requests/${req.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{req.description || "Untitled request"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {req.unit?.building?.name || "—"} · Unit {req.unit?.unitNumber || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="warning" size="sm">Pending review</Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/manager/requests?tab=pending" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all pending requests →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 1 — Owner approval */}
      <div className={active === 1 ? "tab-panel-active" : "tab-panel"}>
        {pendingOwnerApprovalRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No requests awaiting owner approval.</p>
        ) : (
          <div className="space-y-2">
            {pendingOwnerApprovalRequests.slice(0, 5).map((req) => (
              <Link key={req.id} href={`/manager/requests/${req.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{req.description || "Untitled request"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {req.unit?.building?.name || "—"} · Unit {req.unit?.unitNumber || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="destructive" size="sm">Owner approval</Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/manager/requests?tab=owner_approval" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 2 — Disputed invoices */}
      <div className={active === 2 ? "tab-panel-active" : "tab-panel"}>
        {disputedInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">No disputed invoices.</p>
        ) : (
          <div className="space-y-2">
            {disputedInvoices.slice(0, 5).map((inv) => (
              <Link key={inv.id} href={`/manager/finance/invoices?invoiceId=${inv.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {inv.invoiceNumber || "Invoice"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {inv.contractor?.name || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="destructive" size="sm">Disputed</Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/manager/finance/invoices" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all disputed →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 3 — Stale jobs */}
      <div className={active === 3 ? "tab-panel-active" : "tab-panel"}>
        {staleJobs.length === 0 ? (
          <p className="text-sm text-slate-500">No stale jobs.</p>
        ) : (
          <div className="space-y-2">
            {staleJobs.slice(0, 5).map((job) => (
              <Link key={job.id} href={job.requestId ? `/manager/requests/${job.requestId}` : "/manager/requests?tab=active"} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {job.requestDescription || `Job #${job.id?.slice(0, 8)}`}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {job.buildingName || "—"}{job.unitNumber ? ` · Unit ${job.unitNumber}` : ""} · In progress &gt; 7 days
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="warning" size="sm">Stale</Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/manager/requests?tab=active" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all stale jobs →
            </Link>
          </div>
        )}
      </div>

      {/* Tab 4 — RFP routed */}
      <div className={active === 4 ? "tab-panel-active" : "tab-panel"}>
        {rfpPendingRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No auto-routed RFPs.</p>
        ) : (
          <div className="space-y-2">
            {rfpPendingRequests.slice(0, 5).map((req) => (
              <Link key={req.id} href={`/manager/requests/${req.id}`} className="link-card">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{req.description || "RFP request"}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {req.unit?.building?.name || "—"} · Unit {req.unit?.unitNumber || "—"}
                    </div>
                  </div>
                  <div className="ml-6 shrink-0">
                    <Badge variant="info" size="sm">RFP created</Badge>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/manager/requests?tab=rfp_open" className="block text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1">
              View all RFPs →
            </Link>
          </div>
        )}
      </div>

      {totalActions === 0 && (
        <p className="text-sm text-green-700 mt-3">✓ No items require immediate action</p>
      )}
    </div>
  );
}

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  const [requests, setRequests] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // ─── Portfolio summary ───
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const { from, to } = ytdRange();
      const res = await fetch(`/api/financials/portfolio-summary?from=${from}&to=${to}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load portfolio");
      setPortfolio(json.data);
    } catch (e) {
      setPortfolioError(String(e?.message || e));
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      // Fetch all data in parallel (H5: use view=summary for dashboard KPIs)
      const [reqRes, jobRes, invRes] = await Promise.all([
        fetch("/api/requests?view=summary", { headers: authHeaders() }),
        fetch("/api/jobs?view=summary", { headers: authHeaders() }),
        fetch("/api/invoices?view=summary", { headers: authHeaders() }),
      ]);

      const reqData = await reqRes.json();
      const jobData = await jobRes.json();
      const invData = await invRes.json();

      if (!reqRes.ok) throw new Error(reqData?.error?.message || "Failed to load requests");
      if (!jobRes.ok) throw new Error(jobData?.error?.message || "Failed to load jobs");
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");

      setRequests(reqData?.data || []);
      setJobs(jobData?.data || []);
      setInvoices(invData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ─── KPIs ───
  const pendingReviewRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_REVIEW"),
    [requests]
  );

  const pendingOwnerApprovalRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_OWNER_APPROVAL"),
    [requests]
  );

  const rfpPendingRequests = useMemo(
    () => requests.filter((r) => r.status === "RFP_PENDING"),
    [requests]
  );

  const disputedInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "DISPUTED"),
    [invoices]
  );

  const staleJobs = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    return jobs.filter((j) => {
      if (j.status !== "IN_PROGRESS") return false;
      const startTime = j.startedAt ? new Date(j.startedAt).getTime() : new Date(j.createdAt).getTime();
      return now - startTime > staleThresholdMs;
    });
  }, [jobs]);

  const openRequestsCount = useMemo(
    () => requests.filter((r) => ["PENDING_REVIEW", "PENDING_OWNER_APPROVAL", "RFP_PENDING", "APPROVED", "ASSIGNED"].includes(r.status)).length,
    [requests]
  );

  const openJobsCount = useMemo(
    () => jobs.filter((j) => ["PENDING", "IN_PROGRESS"].includes(j.status)).length,
    [jobs]
  );

  const spendThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return invoices
      .filter((inv) => {
        if (inv.status !== "PAID" || !inv.paidAt) return false;
        const paidDate = new Date(inv.paidAt);
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
  }, [invoices]);

  const pendingInvoicesCount = useMemo(
    () => invoices.filter((i) => i.status === "ISSUED").length,
    [invoices]
  );

  const avgDaysToComplete = useMemo(() => {
    const completed = jobs.filter((j) => j.status === "COMPLETED" && j.completedAt && j.createdAt);
    if (completed.length === 0) return null;
    const totalDays = completed.reduce((sum, j) => {
      return sum + (new Date(j.completedAt) - new Date(j.createdAt)) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / completed.length);
  }, [jobs]);

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title="Manager Dashboard" subtitle="Portfolio overview and action-required items" />
          <PageContent>
            <p className="loading-text">Loading dashboard…</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Manager Dashboard"
          subtitle="Portfolio overview and action-required items"
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => { loadDashboardData(); loadPortfolio(); }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          }
        />

        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          {/* ─── KPIs ─── */}
          <Section title="KPIs">
            <div className="kpi-grid gap-4 xl:grid-cols-4">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Open Requests</div>
                <div className={cn("mt-3 text-2xl font-semibold tracking-tight", openRequestsCount > 20 ? "text-amber-700" : "text-slate-900")}>
                  {openRequestsCount}
                </div>
                <div className="text-sm text-slate-600">
                  Pending, approved, assigned
                </div>
              </div>
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Open Jobs</div>
                <div className={cn("mt-3 text-2xl font-semibold tracking-tight", openJobsCount > 15 ? "text-amber-700" : "text-slate-900")}>
                  {openJobsCount}
                </div>
                <div className="text-sm text-slate-600">
                  Pending + in progress
                </div>
              </div>
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Spend This Month</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(spendThisMonth)}
                </div>
                <div className="text-sm text-slate-600">
                  Paid invoices
                </div>
              </div>
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending Invoices</div>
                <div className={cn("mt-3 text-2xl font-semibold tracking-tight", pendingInvoicesCount > 0 ? "text-amber-700" : "text-slate-900")}>
                  {pendingInvoicesCount}
                </div>
                <div className="text-sm text-slate-600">
                  Awaiting payment
                </div>
              </div>
              <div className={cn("rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm", !portfolio && "col-span-2")}>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Avg Days to Complete</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {avgDaysToComplete ?? "—"}
                </div>
                <div className="text-sm text-slate-600">
                  Completed jobs
                </div>
              </div>
              {portfolio && (
                <>
                  <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Portfolio NOI</div>
                    <div className={cn("mt-3 text-2xl font-semibold tracking-tight", portfolio.totalNetIncomeCents >= 0 ? "text-success-text" : "text-destructive-text")}>
                      {formatChfCents(portfolio.totalNetIncomeCents)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {formatPercent(portfolio.avgCollectionRate)} avg collection
                    </div>
                  </div>
                  <Link
                    href="/manager/finance"
                    className="rounded-2xl border border-surface-border bg-slate-50 p-5 shadow-sm flex flex-col justify-between hover:bg-surface-hover transition-colors no-underline col-span-2"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Buildings in Red</div>
                    <div className={cn("mt-2 text-2xl font-semibold tracking-tight", portfolio.buildingsInRed > 0 ? "text-destructive-text" : "text-success-text")}>
                      {portfolio.buildingsInRed} / {portfolio.buildingCount}
                    </div>
                    <div className="mt-1 text-sm font-medium text-indigo-600">View finance →</div>
                  </Link>
                </>
              )}
              {!portfolio && !portfolioLoading && (
                <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm col-span-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Portfolio</div>
                  <div className="mt-3 text-sm text-slate-500">No portfolio data available</div>
                </div>
              )}
              {portfolioLoading && !portfolio && (
                <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm col-span-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Portfolio</div>
                  <div className="mt-3 text-sm text-slate-500">Loading…</div>
                </div>
              )}
            </div>
          </Section>

          <ErrorBanner error={portfolioError} className="text-sm" />

          {/* ─── Quick Links ─── */}
          <Section title="Quick Links">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/manager/requests" className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors no-underline">
                <div className="text-sm font-semibold text-slate-900">All Requests</div>
                <div className="mt-0.5 text-xs text-slate-500">Review and manage work requests</div>
              </Link>
              <Link href="/manager/finance/invoices" className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors no-underline">
                <div className="text-sm font-semibold text-slate-900">Invoices</div>
                <div className="mt-0.5 text-xs text-slate-500">Approve, dispute, and track payments</div>
              </Link>
              <Link href="/manager/leases" className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors no-underline">
                <div className="text-sm font-semibold text-slate-900">Leases</div>
                <div className="mt-0.5 text-xs text-slate-500">Active and pending lease contracts</div>
              </Link>
              <Link href="/admin-inventory" className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors no-underline">
                <div className="text-sm font-semibold text-slate-900">Inventory</div>
                <div className="mt-0.5 text-xs text-slate-500">Buildings, units, and appliances</div>
              </Link>
            </div>
          </Section>

          {/* ─── Action Items (tabbed) ─── */}
          {!loading && (
            <ActionItemsTabs
              pendingReviewRequests={pendingReviewRequests}
              pendingOwnerApprovalRequests={pendingOwnerApprovalRequests}
              disputedInvoices={disputedInvoices}
              staleJobs={staleJobs}
              rfpPendingRequests={rfpPendingRequests}
            />
          )}

          {/* ─── Building Performance (YTD) ─── */}
          {portfolio && portfolio.buildings.length > 0 && (
            <Section title="Building Performance (YTD)">
              <>
                {/* Mobile card list — sm:hidden */}
                <div className="sm:hidden overflow-hidden rounded-lg border border-table-border divide-y divide-table-divider">
                  {portfolio.buildings.map((b) => (
                    <div key={b.buildingId} className="table-card">
                      <div className="flex items-center gap-2">
                        <HealthDot health={b.health} />
                        <span className="table-card-head">{b.buildingName}</span>
                      </div>
                      <div className="table-card-footer">
                        <span className={cn("font-medium font-mono", b.netIncomeCents >= 0 ? "text-green-700" : "text-red-700")}>
                          {formatChfCents(b.netIncomeCents)}
                        </span>
                        <span>Collection {formatPercent(b.collectionRate)}</span>
                        <Link href={`/admin-inventory/buildings/${b.buildingId}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700" onClick={(e) => e.stopPropagation()}>Details</Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Wide table — hidden sm:block */}
                <div className="hidden sm:block rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Building</th>
                        <th className="text-center">Health</th>
                        <th className="text-right">Net Income</th>
                        <th className="text-right">Collection</th>
                        <th className="text-right">Units</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.buildings.map((b) => (
                        <tr key={b.buildingId}>
                          <td className="cell-bold">{b.buildingName}</td>
                          <td className="text-center"><HealthDot health={b.health} /></td>
                          <td className={cn("text-right font-mono text-sm", b.netIncomeCents >= 0 ? "text-green-700" : "text-red-700")}>
                            {formatChfCents(b.netIncomeCents)}
                          </td>
                          <td className="text-right">{formatPercent(b.collectionRate)}</td>
                          <td className="text-right">{b.activeUnitsCount}</td>
                          <td className="text-right">
                            <Link
                              href={`/admin-inventory/buildings/${b.buildingId}`}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            </Section>
          )}

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
