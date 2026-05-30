import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Section from "../../components/layout/Section";
import Panel from "../../components/layout/Panel";
import ContractorPicker from "../../components/ContractorPicker";
import { formatChf as formatCurrency, formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";
import { cn } from "../../lib/utils";
import { withTranslations } from "../../lib/i18n";
import { useTranslation } from "next-i18next";
export default function ContractorDashboard() {
  const { t } = useTranslation("contractor");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      // Fetch contractor-relevant data (H5: use view=summary; prefer contractor-scoped endpoints)
      const contractorId = typeof window !== "undefined" ? localStorage.getItem("contractorId") : null;
      const jobUrl = contractorId
        ? `/api/contractor/jobs?contractorId=${contractorId}&view=summary`
        : "/api/jobs?view=summary";
      const invUrl = contractorId
        ? `/api/contractor/invoices?contractorId=${contractorId}&view=summary`
        : "/api/invoices?view=summary";
      const [jobRes, invRes] = await Promise.all([
        fetch(jobUrl, { headers: authHeaders() }),
        fetch(invUrl, { headers: authHeaders() }),
      ]);

      const jobData = await jobRes.json();
      const invData = await invRes.json();

      if (!jobRes.ok) throw new Error(jobData?.error?.message || "Failed to load jobs");
      if (!invRes.ok) throw new Error(invData?.error?.message || "Failed to load invoices");

      setJobs(jobData?.data || []);
      setInvoices(invData?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ─── KPIs ───
  const pendingJobs = useMemo(
    () => jobs.filter((j) => j.status === "PENDING"),
    [jobs]
  );

  const staleInProgressJobs = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    return jobs.filter((j) => {
      if (j.status !== "IN_PROGRESS") return false;
      const startTime = j.startedAt ? new Date(j.startedAt).getTime() : new Date(j.createdAt).getTime();
      return now - startTime > staleThresholdMs;
    });
  }, [jobs]);

  const completedNotInvoiced = useMemo(() => {
    // Jobs completed but without invoices
    const jobsWithInvoices = new Set(invoices.map((inv) => inv.jobId));
    return jobs.filter((j) => j.status === "COMPLETED" && !jobsWithInvoices.has(j.id));
  }, [jobs, invoices]);

  const openJobsCount = useMemo(
    () => jobs.filter((j) => ["PENDING", "IN_PROGRESS"].includes(j.status)).length,
    [jobs]
  );

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return jobs.filter((j) => {
      if (j.status !== "COMPLETED" || !j.completedAt) return false;
      const completedDate = new Date(j.completedAt);
      return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
    }).length;
  }, [jobs]);

  const invoicedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return invoices
      .filter((inv) => {
        if (!inv.createdAt) return false;
        const createdDate = new Date(inv.createdAt);
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
  }, [invoices]);

  if (loading) {
    return (
      <AppShell role="CONTRACTOR">
        <PageShell>
          <PageHeader title={t("contractor:index.title.contractorDashboard")} />
          <PageContent>
            <p>{t("contractor:index.text.loadingDashboard")}</p>
          </PageContent>
        </PageShell>
      </AppShell>
    );
  }

  return (
    <AppShell role="CONTRACTOR">
      <PageShell>
        <PageHeader title={t("contractor:index.title.contractorDashboard")} />
        <PageContent>
          <ContractorPicker onSelect={() => loadDashboardData()} />

          {/* Quick Links Section */}
          <Section title={t("contractor:index.title.quickLinks")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button className="button-primary" onClick={() => router.push("/contractor/jobs")}>
                🔧 All Jobs
              </button>
                <button className="button-primary" onClick={() => router.push("/contractor/rfps")}>
                📋 RFPs
              </button>
                <button className="button-primary" onClick={() => router.push("/contractor/invoices")}>
                💰 Invoices
              </button>
                <button className="button-primary" onClick={() => router.push("/contractor/status-updates")}>
                📝 Status Updates
              </button>
            </div>
          </Section>

          {error && (
            <Panel className="bg-red-50 border-red-200">
              <strong className="text-destructive">{t("contractor:index.text.error")}</strong> {error}
            </Panel>
          )}

          {/* Action Required Section */}
          <Section title={t("contractor:index.title.todayActionRequired")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("contractor:index.text.pendingJobs")}</div>
                <div className={cn("mt-3 text-2xl font-semibold tracking-tight", pendingJobs.length > 0 ? "text-amber-700" : "text-foreground-dim")}>
                  {pendingJobs.length}
                </div>
                <div className="text-sm text-muted-text">{t("contractor:index.text.needAcceptancestart")}</div>
                {pendingJobs.length > 0 && (
                  <button className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700" onClick={() => router.push("/contractor/jobs?status=PENDING")}>
                    View Pending Jobs →
                  </button>
                )}
              </div>

              {staleInProgressJobs.length > 0 && (
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("contractor:index.text.staleInprogressJobs")}</div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-amber-700">
                    {staleInProgressJobs.length}
                  </div>
                  <div className="text-sm text-muted-text">Active &gt; 7 days</div>
                  <button className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700" onClick={() => router.push("/contractor/jobs?status=IN_PROGRESS")}>
                    Review Jobs →
                  </button>
                </div>
              )}

              {completedNotInvoiced.length > 0 && (
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("contractor:index.text.completedNotInvoiced")}</div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-blue-700">
                    {completedNotInvoiced.length}
                  </div>
                  <div className="text-sm text-muted-text">{t("contractor:index.text.readyForBilling")}</div>
                  <button className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700" onClick={() => router.push("/contractor/jobs?status=COMPLETED")}>
                    Create Invoices →
                  </button>
                </div>
              )}

              {pendingJobs.length === 0 && 
               staleInProgressJobs.length === 0 && 
               completedNotInvoiced.length === 0 && (
                <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                  <p className="text-green-700 m-0">{t("contractor:index.text.noItemsRequireImmediateAction")}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Pipeline KPIs Section */}
          <Section title={t("contractor:index.title.pipelineOverview")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("contractor:index.text.openJobs")}</div>
                <div className={cn("mt-3 text-2xl font-semibold tracking-tight", openJobsCount > 0 ? "text-blue-700" : "text-foreground-dim")}>
                  {openJobsCount}
                </div>
                <div className="text-sm text-muted-text">{t("contractor:index.text.pendingInProgress")}</div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("contractor:index.text.completedThisMonth")}</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-green-700">
                  {completedThisMonth}
                </div>
                <div className="text-sm text-muted-text">{t("contractor:index.text.jobsFinished")}</div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-foreground-dim">{t("contractor:index.text.invoicedThisMonth")}</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-green-700">
                  {formatCurrency(invoicedThisMonth)}
                </div>
                <div className="text-sm text-muted-text">{t("contractor:index.text.totalBilled")}</div>
              </div>
            </div>
          </Section>

        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getStaticProps = withTranslations(["common","contractor"]);
