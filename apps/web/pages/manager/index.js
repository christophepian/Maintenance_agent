import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import Section from "../../components/layout/Section";
import { formatChf as formatCurrency, formatChfCents, formatPercent, formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";

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
  green: { bg: "bg-emerald-500", ring: "ring-emerald-200" },
  amber: { bg: "bg-amber-500", ring: "ring-amber-200" },
  red:   { bg: "bg-red-500",   ring: "ring-red-200" },
};
function HealthDot({ health }) {
  const c = HEALTH_DOT[health] || HEALTH_DOT.amber;
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.bg} ring-2 ${c.ring}`} />;
}

/* ─── Collapsible section with chevron ─── */
function CollapsibleSection({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 group-hover:text-slate-900 transition-colors">
          {title}
        </span>
        {badge != null && (
          <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function ManagerDashboard() {
  const router = useRouter();
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

  if (loading) {
    return (
      <AppShell role="MANAGER">
        <PageShell>
          <PageHeader title="Manager Dashboard" />
          <PageContent>
            <p>Loading dashboard...</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Manager Dashboard" />
        <PageContent>
          {/* Quick Links Section */}
          <Section title="Quick Links">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <button className="button-primary" onClick={() => router.push("/manager/requests")}>
                📋 All Requests
              </button>
              <button className="button-primary" onClick={() => router.push("/manager/finance/invoices")}>
                💰 Invoices
              </button>
              <button className="button-primary" onClick={() => router.push("/manager/leases")}>
                📄 Leases
              </button>
              <button className="button-primary" onClick={() => router.push("/admin-inventory")}>
                🏢 Inventory
              </button>
            </div>
          </Section>

          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong className="text-err-text">Error:</strong> {error}
            </Panel>
          )}

          {/* Action Required Section */}
          <CollapsibleSection title="Action Required" badge={pendingReviewRequests.length + pendingOwnerApprovalRequests.length + disputedInvoices.length + staleJobs.length + rfpPendingRequests.length || null}>
            <div className="grid gap-3">
              <Panel>
                <Link href="/manager/requests?filter=PENDING_REVIEW" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <strong className="m-0">Requests Pending Review</strong>
                      <div className="text-subtle">Manager approval required</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: pendingReviewRequests.length > 0 ? "#7a4a00" : "#999" }}>
                      {pendingReviewRequests.length}
                    </div>
                  </div>
                </Link>
              </Panel>

              {pendingOwnerApprovalRequests.length > 0 && (
                <Panel>
                  <Link href="/manager/requests?filter=PENDING_OWNER_APPROVAL" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <strong className="m-0">Owner Approval Pending</strong>
                        <div className="text-subtle">High-value requests</div>
                      </div>
                      <div style={{ fontSize: "2em", fontWeight: 700, color: "#7a1f1f" }}>
                        {pendingOwnerApprovalRequests.length}
                      </div>
                    </div>
                  </Link>
                </Panel>
              )}

              {disputedInvoices.length > 0 && (
                <Panel>
                  <Link href="/manager/finance/invoices?status=DISPUTED" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <strong className="m-0">Disputed Invoices</strong>
                        <div className="text-subtle">Require resolution</div>
                      </div>
                      <div style={{ fontSize: "2em", fontWeight: 700, color: "#b30000" }}>
                        {disputedInvoices.length}
                      </div>
                    </div>
                  </Link>
                </Panel>
              )}

              {staleJobs.length > 0 && (
                <Panel>
                  <Link href="/manager/requests?stale=true" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <strong className="m-0">Stale Jobs</strong>
                        <div className="text-subtle">In progress &gt; 7 days</div>
                      </div>
                      <div style={{ fontSize: "2em", fontWeight: 700, color: "#7a4a00" }}>
                        {staleJobs.length}
                      </div>
                    </div>
                  </Link>
                </Panel>
              )}

              {rfpPendingRequests.length > 0 && (
                <Panel>
                  <Link href="/manager/rfps" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <strong className="m-0">Auto-routed to RFP</strong>
                        <div className="text-subtle">Legal engine created RFPs</div>
                      </div>
                      <div style={{ fontSize: "2em", fontWeight: 700, color: "#4338ca" }}>
                        {rfpPendingRequests.length}
                      </div>
                    </div>
                  </Link>
                </Panel>
              )}

              {pendingReviewRequests.length === 0 && 
               pendingOwnerApprovalRequests.length === 0 && 
               disputedInvoices.length === 0 && 
               staleJobs.length === 0 &&
               rfpPendingRequests.length === 0 && (
                <Panel>
                  <p className="text-ok-text m-0">✓ No items require immediate action</p>
                </Panel>
              )}
            </div>
          </CollapsibleSection>

          {/* Operational KPIs Section */}
          <CollapsibleSection title="Operational Health">
            <div className="grid gap-3">
              <Panel>
                <Link href="/manager/requests" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <strong className="m-0">Open Requests</strong>
                      <div className="text-subtle">Pending, approved, assigned</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: openRequestsCount > 20 ? "#7a4a00" : "#0b3a75" }}>
                      {openRequestsCount}
                    </div>
                  </div>
                </Link>
              </Panel>

              <Panel>
                <Link href="/manager/jobs" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <strong className="m-0">Open Jobs</strong>
                      <div className="text-subtle">Pending + in progress</div>
                    </div>
                    <div style={{ fontSize: "2em", fontWeight: 700, color: openJobsCount > 15 ? "#7a4a00" : "#0b3a75" }}>
                      {openJobsCount}
                    </div>
                  </div>
                </Link>
              </Panel>

              <Panel>
                <Link href="/manager/finance/invoices" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <strong className="m-0">Spend This Month</strong>
                      <div className="text-subtle">Paid invoices</div>
                    </div>
                    <div style={{ fontSize: "1.6em", fontWeight: 700, color: "#116b2b" }}>
                      {formatCurrency(spendThisMonth)}
                    </div>
                  </div>
                </Link>
              </Panel>
            </div>
          </CollapsibleSection>

          {/* ─── Building Financial Performance ─── */}
          <CollapsibleSection title="Building Performance (YTD)" badge={portfolio ? portfolio.buildingCount : null}>
            {portfolioError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {portfolioError}
              </div>
            )}

            {portfolioLoading && !portfolio && (
              <p className="text-sm text-slate-500">Loading portfolio data…</p>
            )}

            {portfolio && (
              <>
                {/* Aggregate KPIs */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Portfolio NOI</div>
                    <div className={`mt-1 text-xl font-bold ${portfolio.totalNetIncomeCents >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatChfCents(portfolio.totalNetIncomeCents)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Avg Collection</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {formatPercent(portfolio.avgCollectionRate)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Active Units</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {portfolio.totalActiveUnits}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Buildings in Red</div>
                    <div className={`mt-1 text-xl font-bold ${portfolio.buildingsInRed > 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {portfolio.buildingsInRed} / {portfolio.buildingCount}
                    </div>
                  </div>
                </div>

                {/* Per-building compact table */}
                {portfolio.buildings.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <table className="inline-table">
                      <thead>
                        <tr>
                          <th>Building</th>
                          <th className="text-center">Health</th>
                          <th className="text-right">Net Income</th>
                          <th className="text-right">Collection</th>
                          <th className="text-right hidden sm:table-cell">Units</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.buildings.map((b) => (
                          <tr key={b.buildingId}>
                            <td className="cell-bold">{b.buildingName}</td>
                            <td className="text-center"><HealthDot health={b.health} /></td>
                            <td className={`text-right font-mono text-sm ${b.netIncomeCents >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                              {formatChfCents(b.netIncomeCents)}
                            </td>
                            <td className="text-right">{formatPercent(b.collectionRate)}</td>
                            <td className="text-right hidden sm:table-cell">{b.activeUnitsCount}</td>
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
                )}

                {portfolio.buildings.length === 0 && (
                  <p className="text-sm text-slate-500">No buildings with financial data found.</p>
                )}
              </>
            )}
          </CollapsibleSection>

        </PageContent>
      </PageShell>
    </AppShell>
  );
}
