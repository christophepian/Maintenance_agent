import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import ErrorBanner from "../../components/ui/ErrorBanner";
import KpiCard from "../../components/ui/KpiCard";
import { cn } from "../../lib/utils";
import { authHeaders } from "../../lib/api";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "contractors", label: "Contractors" },
  { key: "cost-analysis", label: "Cost Analysis" },
  { key: "timelines", label: "Timelines" },
];
const TAB_KEYS = TABS.map((t) => t.key);

const OPEN_STATUSES = ["PENDING_REVIEW", "PENDING_OWNER_APPROVAL", "RFP_PENDING", "APPROVED", "ASSIGNED"];
const ACTIVE_JOB_STATUSES = ["PENDING", "IN_PROGRESS"];

export default function ReportsPage() {
  const router = useRouter();
  const activeTab = router.isReady
    ? Math.max(0, TAB_KEYS.indexOf(router.query.tab)) || 0
    : 0;
  const setActiveTab = useCallback(
    (index) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, tab: TAB_KEYS[index] } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kpis, setKpis] = useState({ openRequests: 0, activeJobs: 0, pendingInvoices: 0, avgDays: null });

  useEffect(() => {
    if (activeTab !== 0) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [reqRes, jobRes, invRes] = await Promise.all([
          fetch("/api/requests?view=summary", { headers: authHeaders() }),
          fetch("/api/jobs?view=summary", { headers: authHeaders() }),
          fetch("/api/invoices?view=summary", { headers: authHeaders() }),
        ]);
        if (!reqRes.ok || !jobRes.ok || !invRes.ok) throw new Error("Failed to load summary data");
        const [reqData, jobData, invData] = await Promise.all([reqRes.json(), jobRes.json(), invRes.json()]);
        if (cancelled) return;

        const requests = reqData?.data || [];
        const jobs = jobData?.data || [];
        const invoices = invData?.data || [];

        const openRequests = requests.filter((r) => OPEN_STATUSES.includes(r.status)).length;
        const activeJobs = jobs.filter((j) => ACTIVE_JOB_STATUSES.includes(j.status)).length;
        const pendingInvoices = invoices.filter((i) => i.status === "ISSUED").length;

        // Avg days to completion for completed jobs
        const completed = jobs.filter((j) => j.status === "COMPLETED" && j.completedAt && j.createdAt);
        let avgDays = null;
        if (completed.length > 0) {
          const totalDays = completed.reduce((sum, j) => {
            return sum + (new Date(j.completedAt) - new Date(j.createdAt)) / (1000 * 60 * 60 * 24);
          }, 0);
          avgDays = Math.round(totalDays / completed.length);
        }

        setKpis({ openRequests, activeJobs, pendingInvoices, avgDays });
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Reports" subtitle="Portfolio analytics and performance" />
        <PageContent>
          <ErrorBanner error={error} className="text-sm" />

          {/* Tab strip */}
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === i
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Panel bodyClassName="p-0">
            {/* Overview tab */}
            <div className={activeTab === 0 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((k) => (
                      <div key={k} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-5 h-24" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <KpiCard label="Open Requests" value={kpis.openRequests} accent="brand" />
                    <KpiCard label="Active Jobs" value={kpis.activeJobs} accent="warning" />
                    <KpiCard label="Pending Invoices" value={kpis.pendingInvoices} accent="destructive" />
                    <KpiCard label="Avg. Days to Complete" value={kpis.avgDays ?? "—"} accent="success" />
                  </div>
                )}
              </div>
            </div>

            {/* Contractors tab — stub */}
            <div className={activeTab === 1 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                <div className="empty-state">
                  <p className="empty-state-text">Contractor performance metrics — coming in a future update.</p>
                </div>
              </div>
            </div>

            {/* Cost Analysis tab — stub */}
            <div className={activeTab === 2 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                <div className="empty-state">
                  <p className="empty-state-text">Cost breakdowns and trends — coming in a future update.</p>
                </div>
              </div>
            </div>

            {/* Timelines tab — stub */}
            <div className={activeTab === 3 ? "tab-panel-active" : "tab-panel"}>
              <div className="px-4 py-4">
                <div className="empty-state">
                  <p className="empty-state-text">Resolution timeline analytics — coming in a future update.</p>
                </div>
              </div>
            </div>
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
